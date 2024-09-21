import {asyncHandler} from "../utils/asyncHandeler.js";
import { ApiError  } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponce.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshToken = async(userId) => {
    try{
       const user = await User.findById(userId);
       const accessToken = user.generateAccessToken();
       const refreshToken = user.generateRefreshToken();

       user.refreshToken = refreshToken;
       await user.save({validateBeforeSave: false})

       return {accessToken, refreshToken}

    }catch(error){
        throw new ApiError(500, "Something went wrong while generating refresh and acess token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    //get user details from frontend
   const { fullName, email, username, password } = req.body

     //validation - not-empty
    if(
        [fullName,email,username,password].some((field) => 
            field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }
   
    //check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if(existedUser) {
        throw new ApiError(409, "User with email or Username already exist")
    }   

    //check for images, check for avtar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    
    if((req.files) && Array.isArray(req.files.coverImage) && (req.files.coverImage.length > 0) ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
   
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    //upload them to cludinery, avtar
    const avatar =  await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //create user object - create entry in db
    //remove password and refresh token field from response
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createduser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //check for user creation
    if(!createduser) {
        throw new ApiError(500, "Something went wrong while creating user")
    }

    //return res
    return res.status(201).json(
        new ApiResponse(200, createduser, "User registered Successfully")
    )

} )

const loginUser = asyncHandler( async (req, res) => {
    //re q body -> data
    const {email, username, password} = req.body
 
     //username or email
    if(!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    //find the user
    const user = await User.findOne({
        $or: [ { username }, { email }]
    })

    if(!user) {
        throw new ApiError(404, "User does not exist")
    }
    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid user credential")
    }
    //access and refresh token
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)
 
    //send cookie
    const loggedInUser =await User.findById(user._id).select("-password -refreshToken")

    const Options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, Options)
    .cookie("refreshToken", refreshToken, Options)
    .json(
        new ApiResponse(200, {
            user:{ loggedInUser}, 
            accessToken, 
            refreshToken
             },
             "User logged in Successfully"
         )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
        
    )

    const Options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken",Options)
    .clearCookie("refreshToken", Options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken //body->as phones se cookie 
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const Options = {
            httpOnly: true,
            secure: true
        }
    
        const {newaccessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res 
        .status(200)
        .cookie("accessToken", newaccessToken,Options)
        .cookie("refreshToken", newrefreshToken, Options)
        .json(
            new ApiResponse(
                200,
                {refreshToken: newrefreshToken, accessToken: newaccessToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Inavalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(new ApiResponse(200, {}, "Password Change SucessFully"))

})

const getCurrentUser = asyncHandler(async (req,res) => {
    return res.status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler( async(req,res) => {
    const [{fullName, email}] = req.body

    if(!fullName || !email) {
        throw new ApiError(400,"All fieds are required" )
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details Sucessfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user =  await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "AvatarnImage updated Sucessfully")
    )
})

const updateUserCovetImage = asyncHandler(async(req,res) => {
    const conerImageLocalPath = req.file?.path
    if(!conerImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(conerImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploading Coner Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image updated Sucessfully")
    )
})

export { registerUser,
        loginUser,
        logoutUser,
        refreshAccessToken,
        changeCurrentPassword,
        getCurrentUser,
        updateAccountDetails,
        updateUserAvatar,
        updateUserCovetImage
 };