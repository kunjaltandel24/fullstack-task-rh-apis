import { model, Schema } from 'mongoose'

import ITag from '@/interfaces/ITag'

const TagSchema: Schema = new Schema<ITag>({
	tagName: {
		type: String,
		unique: true,
		required: true,
	},
	numberOfImages: {
		type: Number,
		default: 0,
	},
}, {
	timestamps: true,
})

TagSchema.index({
	tagName: 'text',
})

export default model<ITag>('Tag', TagSchema)
