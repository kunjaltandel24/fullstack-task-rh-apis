import { model, Schema, Types } from 'mongoose'

import IPayment from '@/interfaces/IPayment'

const PaymentSchema: Schema = new Schema<IPayment>({
	stripeCheckoutSessionId: {
		type: String,
	},
	price: {
		type: Number,
		required: true,
	},
	applicationFee: {
		type: Number,
		required: true,
	},
	stripeFee: {
		type: Number,
		required: true,
	},
	images: {
		type: [{
			type: Types.ObjectId,
			required: true,
			ref: 'Image',
		}],
		required: true,
	},
	buyer: {
		type: Types.ObjectId,
		required: true,
		ref: 'User',
	},
	failedTransfers: [{
		type: Types.ObjectId,
		ref: 'User',
	}],
	transfers: {
		type: [{
			user: {
				type: Types.ObjectId,
				required: true,
				ref: 'User',
			},
			amount: {
				type: Number,
				required: true,
			},
		}],
		required: true,
	},
	transfer_group: {
		type: String,
		required: true,
	},
	paymentCompleted: {
		type: Boolean,
		default: false,
	},
	transferCompleted: {
		type: Boolean,
		default: false,
	},
}, {
	timestamps: true,
})

PaymentSchema.index({
	transfer_group: 'text',
	stripeCheckoutSessionId: 'text',
})

export default model<IPayment>('Payment', PaymentSchema)
