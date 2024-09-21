import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
        subscriber: {
            type: Schema.Types.ObjectId, // one who is subscribing
            ref: "User"
        },
        channel: {
            type: Schema.Types.ObjectId, // one to whom "subscriber" is subscribe
            ref: "User"
        }
    },
        { timestamps: ture }
)

export const subscription = mongoose.model("Subscription", subscriptionSchema)