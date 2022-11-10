import { model, Schema } from 'mongoose'

import IUser from '@/interfaces/IUser'
import { generateRandomString } from '@/utils'

const UserSchema: Schema = new Schema<IUser>({
	username: {
		type: String,
		required: true,
		unique: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
	},
	password: {
		type: String,
		required: true,
	},
	stripeCustomerId: String,
	stripeAccountId: String,
	accountBalance: {
		type: Number,
		required: true,
		default: 0,
	},
	paymentMethods: {
		type: [String],
		required: true,
		default: [],
	},
	verificationCode: {
		type: String,
		default: generateRandomString,
	},
	isVerified: {
		type: Boolean,
		required: true,
		default: false,
	},
	stripeAccountCompleted: {
		type: Boolean,
		required: true,
		default: false,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
}, {
	timestamps: true,
	toObject: { getters: true },
	toJSON: { getters: true },
})

export default model<IUser>('User', UserSchema)
