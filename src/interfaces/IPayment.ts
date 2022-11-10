import { Document, PopulatedDoc } from 'mongoose'

import IImage from '@/interfaces/IImage'
import IUser from '@/interfaces/IUser'

export default interface IPayment {
	stripeTransactionId: string
	image: PopulatedDoc<IImage & Document>
	price: number
	applicationFee: number
	buyer: PopulatedDoc<IUser & Document>
	seller: PopulatedDoc<IUser & Document>
}
