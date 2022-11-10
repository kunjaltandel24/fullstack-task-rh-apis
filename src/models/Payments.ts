import { model, Schema, Types } from 'mongoose'

import IPayment from '@/interfaces/IPayment'

const PaymentSchema: Schema = new Schema<IPayment>({
	stripeTransactionId: {
		type: String,
		required: true,
	},
	price: {
		type: Number,
		required: true,
	},
	applicationFee: {
		type: Number,
		required: true,
	},
	image: {
		type: Types.ObjectId,
		required: true,
		ref: 'Image',
	},
	buyer: {
		type: Types.ObjectId,
		required: true,
		ref: 'User',
	},
	seller: {
		type: Types.ObjectId,
		required: true,
		ref: 'User',
	},
}, {
	timestamps: true,
})

export default model<IPayment>('Payment', PaymentSchema)
