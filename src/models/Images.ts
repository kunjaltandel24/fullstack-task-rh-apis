import { model, Schema, Types } from 'mongoose'

import IImage from '@/interfaces/IImage'

const ImageSchema: Schema = new Schema<IImage>({
	url: {
		type: String,
		required: true,
	},
	description: String,
	user: {
		type: Types.ObjectId,
		ref: 'User',
	},
	isPublic: {
		type: Boolean,
		required: true,
		default: false,
	},
	originalUser: {
		type: Types.ObjectId,
		ref: 'User',
	},
	price: {
		type: Number,
		required: true,
		default: 0,
	},
	tags: {
		type: [String],
		default: [],
	},
	stripePriceId: String,
	stripeProductId: String,
	isDeleted: {
		type: Boolean,
		default: false,
	},
}, {
	timestamps: true,
	toObject: { getters: true },
	toJSON: { getters: true },
})

ImageSchema.index({
	url: 'text',
	description: 'text',
})

export default model<IImage>('Image', ImageSchema)
