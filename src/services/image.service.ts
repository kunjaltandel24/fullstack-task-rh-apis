import { join } from 'path'

import { body, ValidationChain } from 'express-validator'
import { omit } from 'lodash'
import mongoose, { Document, LeanDocument, Types } from 'mongoose'
import Stripe from 'stripe'

import AppConfig from '@/AppConfig'
import IImage from '@/interfaces/IImage'
import ITag from '@/interfaces/ITag'
import IUser from '@/interfaces/IUser'
import logger from '@/logger'
import Images from '@/models/Images'
import Payments from '@/models/Payments'
import Tags from '@/models/Tags'
import StripeService, { IStripeService } from '@/services/stripe.service'
import { IBaseQueryParams, Omit } from '@/utils/CustomTypes'
import imageDiff from '@/utils/imageDiff'

const appConfig = AppConfig()

interface IImageBodyParams extends Omit<IImage, 'isPublic' | 'price' | 'url' | 'user' | 'originalUser'>{
	url: string[]
	isPublic?: boolean
	price?: number
}

interface ImagePricesBodyParams {
	prices: {
		id: string
		price: number
	}[]
}

export interface IImageService {
	stripeService: IStripeService

	uploadImageValidation: ValidationChain[]
	deleteImageValidationChain: ValidationChain[]
	changePermissionValidationChain: ValidationChain[]
	listForSellValidationChain: ValidationChain[]
	checkoutValidationChain: ValidationChain[]

	userImages(
		query: IBaseQueryParams,
		user?: string,
		compImage?: string,
		sessionUser?: IUser & Document,
		populateUser?: boolean,
	): Promise<{
		images: IImage[]
		total: number
	}>
	allPublicImages(query: IBaseQueryParams, compImage?: string, user?: IUser & Document): Promise<{
		images: IImage[]
		total: number
	}>
	allTags(query: IBaseQueryParams): Promise<{
		tags: ITag[]
		total: number
	}>
	updateTags(tags: string[]): Promise<void>
	deleteImages(ids: string[], allImage: boolean, user: IUser & Document): Promise<boolean>
	makeImagesPublicOrPrivate(ids: string[], isPublic: boolean, user: IUser & Document): Promise<boolean>
	uploadImage(body: IImageBodyParams, user: IUser & Document): Promise<{ images: LeanDocument<IImage>[] }>
	imageDetails(id: string, user?: IUser & Document): Promise<LeanDocument<IImage>>
	updateImagePrices(body: ImagePricesBodyParams, user: IUser & Document): Promise<LeanDocument<IImage>[]>
	verifyDiscountCode(body: { discountCode: string }): Promise<boolean>
	checkoutSessionCompletion(body: unknown, signature: string): Promise<boolean>
	checkoutSession(
		body: { images: string[], discountCode?: string, currentUrl: string },
		user: IUser & Document,
	): Promise<{
		paymentLink: string
		url: string
	}>
}

export default class ImageService implements IImageService {
	stripeService: IStripeService

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

	listForSellValidationChain: ValidationChain[] = [
		body('prices', 'image prices are required')
			.exists()
			.isArray({ min: 1 })
			.withMessage('invalid image prices'),
		body('prices.*.price', 'image price is required')
			.exists()
			.isFloat({ min: 0.5 })
			.withMessage('invalid image price'),
		body('prices.*.id', 'image id is required')
			.exists(),
	]

	checkoutValidationChain: ValidationChain[] = [
		body('images', 'checkout images are required')
			.exists()
			.isArray({ min: 1 })
			.withMessage('checkout images are required'),
		body('currentUrl', 'user\'s current page url is required')
			.exists(),
	]

	constructor() {
		this.stripeService = new StripeService()
	}

	async userImages(
		query: IBaseQueryParams,
		user?: string,
		compImage?: string,
		sessionUser?: IUser & Document,
		populateUser?: boolean,
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
			}, {
				$or: [
					{ isDeleted: { $exists: false } },
					{ isDeleted: false },
				],
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

		if (populateUser || sessionUser?._id !== user) {
			call
				.populate({
					path: 'user',
					select: '_id username stripeCustomerId stripeAccountId',
				})
		}

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
		return this.userImages(query, undefined, compImage, user, true)
	}

	async allTags(query: IBaseQueryParams): Promise<{ tags: ITag[]; total: number }> {
		let offset: number = parseInt(query.offset || '', 10)
		let limit: number = parseInt(query.limit || '', 10)
		if (!offset) offset = 0
		if (!limit) limit = 10

		const condition: mongoose.FilterQuery<ITag> = {}

		if (query.q) {
			const queryRexEx = new RegExp(query.q, 'i')
			condition.$or = [
				{ description: { $regex: queryRexEx } },
				{ tags: { $regex: queryRexEx } },
			]
		}

		const call = Tags.find(condition)

		if (query.limit !== 'all') {
			call
				.skip(offset)
				.limit(limit)
		}

		const tags = await call
			.sort({ numberOfImages: -1, createdAt: -1 })
			.lean()
			.exec()

		const total = await Tags.count(condition)
			.exec()

		return {
			tags,
			total,
		}
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
			images: images.map((img) => ({ ...img.toJSON(), url: `${appConfig.APP_URL}/uploads/${img.url}` })),
		}
	}

	async imageDetails(id: string, user?: IUser & Document): Promise<LeanDocument<IImage>> {
		const publicCondition: mongoose.FilterQuery<IImage> = {
			$or: [{ isPublic: true }],
		}
		if (user) {
			publicCondition.$or = publicCondition.$or?.concat([{ user: user._id }])
		}
		const condition: mongoose.FilterQuery<IImage> = {
			$and: [{ _id: id }, {
				$or: [
					{ isDeleted: { $exists: false } },
					{ isDeleted: false },
				],
			}, publicCondition],
		}

		const image = await Images.findOne(condition)
			.populate({
				path: 'user',
				select: '_id username',
			})
			.lean()
			.exec()

		if (!image) {
			throw {
				notFound: true,
				message: 'image not available',
			}
		}

		image.url = `${appConfig.APP_URL}/uploads/${image.url}`

		return image
	}

	async deleteImages(ids: string[], allImage: boolean, user: IUser & Document): Promise<boolean> {
		const condition: mongoose.FilterQuery<IImage> = {
			user: user._id,
		}
		if (!allImage) {
			condition._id = { $in: ids }
		}
		await Images.updateMany(condition, { isDeleted: true }, { multi: true })

		return true
	}

	async makeImagesPublicOrPrivate(ids: string[], isPublic: boolean, user: IUser & Document): Promise<boolean> {
		await Images.updateMany({
			_id: { $in: ids },
			user: user._id,
		}, {
			isPublic,
		}, {
			multi: true,
		})
			.exec()

		return true
	}

	async updateImagePrices(body: ImagePricesBodyParams, user: IUser & Document): Promise<LeanDocument<IImage>[]> {
		const images = await Images.find({
			user: user._id,
			_id: { $in: body.prices.map((price) => price.id) },
		})
			.lean()
			.exec()

		const idPriceMap = Object.fromEntries(body.prices.map(({ id, price }) => [id, price]))
		const imageUpdates: {
			updateOne: {
				filter: { _id: Types.ObjectId }
				update: {
					stripePriceId: string
					stripeProductId?: string
					price: number
				}
			}
		}[] = []

		await Promise.all(images.map((img, i) => {
			if (img.stripeProductId) {
				return this.stripeService.createPrice(img.stripeProductId, idPriceMap[img._id.toString()])
					.then((price) => {
						imageUpdates.push({
							updateOne: {
								filter: { _id: img._id },
								update: {
									stripePriceId: price.id,
									price: idPriceMap[img._id.toString()],
								},
							},
						})
						images[i] = {
							...img,
							stripePriceId: price.id,
							price: idPriceMap[img._id.toString()],
						}
					})
					.catch((error) => logger.error(`error in price update of image ${img._id.toString()} of user ${user._id.toString()}: `, error))
			}
			return this.stripeService.createProductWithPrice(
				`${user.username}_${img.url}`,
				idPriceMap[img._id.toString()],
				img._id.toString(),
			)
				.then((product) => {
					imageUpdates.push({
						updateOne: {
							filter: { _id: img._id },
							update: {
								stripePriceId: (product.default_price as Stripe.Price).id,
								stripeProductId: product.id,
								price: idPriceMap[img._id.toString()],
							},
						},
					})
					images[i] = {
						...img,
						stripePriceId: (product.default_price as Stripe.Price).id,
						stripeProductId: product.id,
						price: idPriceMap[img._id.toString()],
					}
				})
				.catch((error) => logger.error(`error in price update of image ${img._id.toString()} of user ${user._id.toString()}: `, error))
		}))

		await Images.bulkWrite(imageUpdates)

		return images.map((img) => ({ ...img, url: `${appConfig.APP_URL}/uploads/${img.url}` }))
	}

	async verifyDiscountCode(body: { discountCode: string }): Promise<boolean> {
		if (!body.discountCode) {
			throw {
				badRequest: true,
				message: 'discount code is required',
			}
		}
		const coupon = await this.stripeService.checkDiscountCode(body.discountCode)

		if (!coupon) {
			throw {
				notAllowed: true,
				message: 'coupons not available',
			}
		}
		if (coupon.deleted) {
			throw {
				notAllowed: true,
				message: 'coupons not available',
			}
		}
		if (coupon.times_redeemed === coupon.max_redemptions) {
			throw {
				notAllowed: true,
				message: 'all coupons are used',
			}
		}
		return true
	}

	async checkoutSession(
		body: { images: string[]; discountCode?: string; currentUrl: string },
		user: IUser & Document,
	): Promise<{
		paymentLink: string
		url: string
	}> {
		const { images } = body
		const dbImages = await Images.find({
			_id: { $in: images },
		})
			.populate({
				path: 'user',
				select: '_id username stripeAccountId',
			})
			.lean()
			.exec()

		const accountWillGetAmountMap: { [p: string]: number } = {}
		const users: string[] = []
		let price = 0
		let applicationFee = 0
		let stripeFee = 0
		dbImages.forEach((img) => {
			if (!users.includes(img.user.username)) {
				users.push(img.user.username)
			}
			if (!accountWillGetAmountMap[img.user._id.toString()]) {
				accountWillGetAmountMap[img.user._id.toString()] = 0
			}

			const stripeCut = ((img.price * 4) / 100)
			const applicationCut = ((img.price * 1) / 100)
			accountWillGetAmountMap[img.user._id.toString()] += img.price - stripeCut - applicationCut
			price += img.price
			stripeFee += stripeCut
			applicationFee += applicationCut
		})
		const transfer_group = `${users.join('_')}_${Date.now()}_group`
		const payment = new Payments({
			price,
			applicationFee,
			stripeFee,
			transfer_group,
			transfers: Object.entries(accountWillGetAmountMap).map(([user, amount]) => ({ user, amount })),
			images,
			buyer: user._id,
		})
		const checkoutSession = await this.stripeService.checkoutSessionLink(
			dbImages.map((img) => ({
				price: img.stripePriceId as string,
				quantity: 1,
			})),
			body.currentUrl,
			user.stripeCustomerId,
			user._id.toString(),
			images,
			transfer_group,
			body.discountCode,
		)

		payment.stripeCheckoutSessionId = checkoutSession.id

		await payment.save()
		return {
			paymentLink: checkoutSession.payment_link as string,
			url: checkoutSession.url as string,
		}
	}

	async checkoutSessionCompletion(body: string | Buffer, signature: string): Promise<boolean> {
		const event = this.stripeService.stripe.webhooks.constructEvent(
			body,
			signature,
			appConfig.STRIPE_CHECKOUT_WEBHOOK_ENDPOINT_SECRET,
		)

		if (event.type === 'checkout.session.completed') {
			const session = event.data.object as Stripe.Checkout.Session

			const payment = await Payments.findOne({
				transfer_group: session.metadata?.transfer_group,
			})
				.populate({
					path: 'transfers',
					populate: [{
						path: 'user',
						select: '_id stripeAccountId email username',
					}],
				})
				.lean()
				.exec()

			if (payment) {
				const images = await Images.find({
					_id: { $in: payment.images },
				})
					.exec()
				await Images.insertMany(images.map((img) => ({
					...omit(img, ['stripeProductId', 'stripePriceId']),
					user: payment.buyer,
					originalUser: img.user,
					price: 0,
				})))

				const failedTransfers: string[] = []
				await Promise.all(payment.transfers.map((transfer) => this.stripeService.stripe
					.transfers
					.create({
						amount: transfer.amount * 100,
						currency: 'usd',
						destination: transfer.user.stripeAccountId,
						transfer_group: payment.transfer_group,
					})
					.catch((error) => {
						logger
							.error(
								`error completing transferring fund to user: ${
									transfer.user._id.toString()
								} of payment: ${
									payment._id.toString()
								} for checkout session: ${payment.stripeCheckoutSessionId}`,
								error,
							)
						failedTransfers.push(transfer.user._id)
					})))
					.then(() => Payments.updateOne({
						_id: payment._id,
					}, {
						paymentCompleted: true,
						transferCompleted: true,
						failedTransfers,
					}))
					.catch((error) => {
						logger
							.error(
								`error in updating payment: ${
									payment._id.toString()
								}`,
								error,
							)
					})
			}
		}

		return true
	}
}
