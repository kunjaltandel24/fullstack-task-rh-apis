import { Document, PopulatedDoc } from 'mongoose'

import IUser from '@/interfaces/IUser'

export default interface IImage {
	description?: string
	url: string
	price: number
	isPublic: boolean
	user: PopulatedDoc<IUser & Document>
	tags: string[]
	originalUser?: PopulatedDoc<IUser & Document>
}
