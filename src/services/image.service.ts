import { join } from 'path'

import { body, ValidationChain } from 'express-validator'
import mongoose, { Document } from 'mongoose'

import AppConfig from '@/AppConfig'
import IImage from '@/interfaces/IImage'
import IUser from '@/interfaces/IUser'
import Images from '@/models/Images'
import Tags from '@/models/Tags'
import { IBaseQueryParams, Omit } from '@/utils/CustomTypes'
import imageDiff from '@/utils/imageDiff'

const appConfig = AppConfig()

interface IImageBodyParams extends Omit<IImage, 'isPublic' | 'price' | 'url' | 'user' | 'originalUser'>{
	url: string[]
	isPublic?: boolean
	price?: number
}

export interface IImageService {
	uploadImageValidation: ValidationChain[]
	deleteImageValidationChain: ValidationChain[]
	changePermissionValidationChain: ValidationChain[]

	userImages(query: IBaseQueryParams, user?: string, compImage?: string, sessionUser?: IUser & Document): Promise<{
		images: IImage[]
		total: number
	}>
	allPublicImages(query: IBaseQueryParams, compImage?: string, user?: IUser & Document): Promise<{
		images: IImage[]
		total: number
	}>
	updateTags(tags: string[]): Promise<void>
	deleteImages(ids: string[], allImage: boolean, user: IUser & Document): Promise<boolean>
	makeImagesPublicOrPrivate(ids: string[], isPublic: boolean, user: IUser & Document): Promise<boolean>
	uploadImage(body: IImageBodyParams, user: IUser & Document): Promise<{ images: IImage[] }>
}

export default class ImageService implements IImageService {
	uploadImageValidation: ValidationChain[] = [
		body('tags', 'tags are required')
			.exists()
			.isArray({ min: 2 })
			.withMessage('invalid tags'),
		body('url', 'image is required')
			.exists(),
		body('price')
			.optional()
			.isNumeric()
			.withMessage('invalid price'),
	]

	deleteImageValidationChain: ValidationChain[] = [
		body('ids', 'image ids are required')
			.exists()
			.isArray({ min: 1 })
			.withMessage('invalid image ids'),
	]

	changePermissionValidationChain: ValidationChain[] = [
		body('ids', 'image ids are required')
			.exists()
			.isArray({ min: 1 })
			.withMessage('invalid image ids'),
		body('isPublic', 'permission is required')
			.exists()
			.isBoolean()
			.withMessage('invalid permission'),
	]

	async userImages(
		query: IBaseQueryParams,
		user?: string,
		compImage?: string,
		sessionUser?: IUser & Document,
	): Promise<{
		images: IImage[]
		total: number
	}> {
		let offset: number = parseInt(query.offset || '', 10)
		let limit: number = parseInt(query.limit || '', 10)
		if (!offset) offset = 0
		if (!limit) limit = 10

		let similarImageIds: string[] = []
		if (compImage) {
			const compImagePath = join(__dirname, `../../uploads/${compImage}`)
			const images = await Images.find().select('_id url').lean().exec()
			const misMatchPercentages = await Promise.all(images.map((img) => {
				const imgPath = join(__dirname, `../../uploads/${img.url}`)
				return imageDiff(compImagePath, imgPath)
					.then((result) => [img._id.toString(), result])
					.catch((result) => [img._id.toString(), result])
			}))
			similarImageIds = misMatchPercentages.filter((mmp) => mmp[1] < 30)
				.map((mmp) => mmp[0])
		}

		const publicCondition: mongoose.FilterQuery<IImage> = {
			$or: [{ isPublic: true }],
		}
		if (sessionUser) {
			publicCondition.$or = publicCondition.$or?.concat([{ user: sessionUser._id }])
		}
		const condition: mongoose.FilterQuery<IImage> = {
			$and: [{
				user,
			}, publicCondition],
		}

		if (!user) {
			condition.$and?.shift()
		}

		if (similarImageIds?.length) {
			condition.$and?.push({
				_id: { $in: similarImageIds },
			})
		}

		if (query.tags?.length) {
			condition.$and?.push({
				tags: { $in: query.tags },
			})
		}

		if (query.priceMin) {
			condition.$and?.push({
				price: { $gte: query.priceMin },
			})
		}
		if (query.priceMax) {
			condition.$and?.push({
				price: { $lte: query.priceMax },
			})
		}

		if (query.q) {
			const queryRexEx = new RegExp(query.q, 'i')
			condition.$or = [
				{ description: { $regex: queryRexEx } },
				{ tags: { $regex: queryRexEx } },
			]
		}

		const call = Images.find(condition)

		if (query.limit !== 'all') {
			call
				.skip(offset)
				.limit(limit)
		}

		const images = await call
			.sort(query.orderBy || { createdAt: -1 })
			.lean()
			.exec()

		const total = await Images.count(condition)
			.exec()

		return {
			images: images.map((img) => ({ ...img, url: `${appConfig.APP_URL}/uploads/${img.url}` })),
			total,
		}
	}

	allPublicImages(query: IBaseQueryParams, compImage?: string, user?: IUser & Document): Promise<{
		images: IImage[]
		total: number
	}> {
		return this.userImages(query, undefined, compImage, user)
	}

	async updateTags(tags: string[]): Promise<void> {
		await Tags.bulkWrite(tags.map((tagName) => ({
			updateOne: {
				filter: {
					tagName,
				},
				update: {
					$inc: {
						numberOfImages: 1,
					},
				},
				upsert: true,
			},
		})))
	}

	async uploadImage(body: IImageBodyParams, user: IUser & Document): Promise<{ images: IImage[] }> {
		const { url, ...otherBodyParams } = body
		const images = await Images.insertMany(url.map((urlStr) => ({
			user: user._id,
			url: urlStr,
			...otherBodyParams,
		})))
		this.updateTags(body.tags)
			.catch((error) => console.error('error while updating tags: ', error))
		return {
			images: images.map((img) => ({ ...img, url: `${appConfig.APP_URL}/uploads/${img.url}` })),
		}
	}

	async deleteImages(ids: string[], allImage: boolean, user: IUser & Document): Promise<boolean> {
		const condition: mongoose.FilterQuery<IImage> = {
			user: user._id,
		}
		if (!allImage) {
			condition._id = { $in: ids }
		}
		await Images.deleteMany(condition)
			.exec()

		return true
	}

	async makeImagesPublicOrPrivate(ids: string[], isPublic: boolean, user: IUser & Document): Promise<boolean> {
		await Images.updateMany({
			_id: { $in: ids },
			user: user._id,
		}, {
			isPublic,
		})
			.exec()

		return true
	}
}
