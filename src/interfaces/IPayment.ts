import { Document, PopulatedDoc } from 'mongoose'

import IImage from '@/interfaces/IImage'
import IUser from '@/interfaces/IUser'

export default interface IPayment {
	stripeCheckoutSessionId?: string
	images: PopulatedDoc<IImage & Document>[]
	price: number
	applicationFee: number
	stripeFee: number
	buyer: PopulatedDoc<IUser & Document>
	failedTransfers: PopulatedDoc<IUser & Document>[]
	transfers: {
		user: PopulatedDoc<IUser & Document>
		amount: number
	}[]
	transfer_group: string
	paymentCompleted: boolean
	transferCompleted: boolean
}
