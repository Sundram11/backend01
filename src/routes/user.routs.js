import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken, updateUserAvatar, getUserChanelProfile, getCurrentUser, updateAccountDetails } from "../controller/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1 
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refres-token").post(refreshAccessToken)
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/coverImage").patch(verifyJWT, upload.single("coverImage"), updateUserAvatar)
router.route("/c/:username").get(verifyJWT, getUserChanelProfile)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").get(verifyJWT, updateAccountDetails)

export default router;