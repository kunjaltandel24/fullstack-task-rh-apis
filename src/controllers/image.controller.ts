import { extname, join } from 'path'

import {
	Express, Request, Response, Router,
} from 'express'
import { extension } from 'mime-types'
import multer from 'multer'

import AuthController from '@/controllers/auth.controller'
import logger from '@/logger'
import ImageService, { IImageService } from '@/services/image.service'
import ApiResponse from '@/utils/apiResponse'
import { CustomError } from '@/utils/CustomTypes'

export interface IImageController {
	router: Router
	imageService: IImageService

	allPublicImages(req: Request, res: Response): Promise<void>
	userImages(req: Request, res: Response): Promise<void>
	upload(req: Request, res: Response): Promise<void>
	deleteImages(req: Request, res: Response): Promise<void>
	changePermissionOfImages(req: Request, res: Response): Promise<void>
	getAllTags(req: Request, res: Response): Promise<void>
	imageDetails(req: Request, res: Response): Promise<void>
	updateImagePrices(req: Request, res: Response): Promise<void>
	verifyDiscount(req: Request, res: Response): Promise<void>
	checkout(req: Request, res: Response): Promise<void>
	checkoutWebHook(req: Request, res: Response): Promise<void>
}

const storage = multer.diskStorage({
	destination: join(__dirname, '../../uploads'),
	filename(req: Request, file: Express.Multer.File, callback: (error: (Error | null), filename: string) => void) {
		const ext = extension(file.mimetype)
		const count = req.body.url?.length || 0
		const name = `image_${Date.now()}_${count}.${ext}`
		if (!req.body.url) {
			req.body.url = []
		}
		req.body.url.push(name)
		callback(null, name)
	},
})

export default class ImageController extends ApiResponse implements IImageController {
	router: Router

	imageService: IImageService

	constructor() {
		super()
		this.imageService = new ImageService()
		this.router = Router()

		this.router.post(
			'/',
			multer({
				storage,
				fileFilter(req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) {
					// Allowed ext
					const filetypes = /jpeg|jpg|png|gif/

					// Check ext
					const ext = filetypes.test(extname(file.originalname).toLowerCase())
					// Check mime
					const mimetype = filetypes.test(file.mimetype)

					if (mimetype && ext) {
						return callback(null, true)
					}
					return callback(new Error('Error: Images Only!'))
				},
			}).single('image'),
			AuthController.UserAuthMiddleware(true),
			this.allPublicImages,
		)
		this.router.post(
			'/upload',
			AuthController.UserAuthMiddleware(),
			multer({
				storage,
				fileFilter(req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) {
					// Allowed ext
					const filetypes = /jpeg|jpg|png|gif/

					// Check ext
					const ext = filetypes.test(extname(file.originalname).toLowerCase())
					// Check mime
					const mimetype = filetypes.test(file.mimetype)

					if (mimetype && ext) {
						return callback(null, true)
					}
					return callback(new Error('Error: Images Only!'))
				},
			}).array('images', 1000),
			this.imageService.uploadImageValidation,
			this.upload,
		)
		this.router.get(
			'/tags',
			this.getAllTags,
		)
		this.router.get('/:userId', AuthController.UserAuthMiddleware(true), this.userImages)
		this.router.get('/details/:imageId', AuthController.UserAuthMiddleware(true), this.imageDetails)
		this.router.post(
			'/update-prices',
			AuthController.UserAuthMiddleware(),
			this.imageService.listForSellValidationChain,
			this.updateImagePrices,
		)
		this.router.post(
			'/delete',
			AuthController.UserAuthMiddleware(),
			this.imageService.deleteImageValidationChain,
			this.deleteImages,
		)
		this.router.post(
			'/change-permission',
			AuthController.UserAuthMiddleware(),
			this.imageService.changePermissionValidationChain,
			this.changePermissionOfImages,
		)
		this.router.post(
			'/verify-discount-code',
			AuthController.UserAuthMiddleware(),
			this.verifyDiscount,
		)
		this.router.post(
			'/checkout',
			AuthController.UserAuthMiddleware(),
			this.imageService.checkoutValidationChain,
			this.checkout,
		)
		this.router.post(
			'/checkout/webhook',
			this.checkoutWebHook,
		)
	}

	async allPublicImages(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.allPublicImages(req.query, (req.body.url || [])[0], res.locals.user)
			return this.sendSuccess(req, res, 'public images', result)
		} catch (error) {
			logger.error('error in login ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async userImages(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.userImages(req.query, req.params.userId, undefined, res.locals.user)
			return this.sendSuccess(req, res, 'user images', result)
		} catch (error) {
			logger.error('error in register ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async upload(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.uploadImage(req.body, res.locals.user)
			return this.sendSuccess(req, res, 'user verified successfully', result)
		} catch (error) {
			logger.error('error in register ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async deleteImages(req: Request, res: Response): Promise<void> {
		try {
			await this.imageService.deleteImages(req.body.ids, req.body.allImage, res.locals.user)
			return this.sendSuccess(req, res, 'user images deleted successfully')
		} catch (error) {
			logger.error('error in register ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async changePermissionOfImages(req: Request, res: Response): Promise<void> {
		try {
			await this.imageService.makeImagesPublicOrPrivate(req.body.ids, req.body.isPublic, res.locals.user)
			return this.sendSuccess(req, res, 'user images deleted successfully')
		} catch (error) {
			logger.error('error in register ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async getAllTags(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.allTags(req.query)
			return this.sendSuccess(req, res, 'existing tags', result)
		} catch (error) {
			logger.error('error in register ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async imageDetails(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.imageDetails(req.params.imageId, res.locals.user)
			return this.sendSuccess(req, res, 'image details', result)
		} catch (error) {
			logger.error('error in imageDetails ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async updateImagePrices(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.updateImagePrices(req.body, res.locals.user)
			return this.sendSuccess(req, res, 'image prices updated', result)
		} catch (error) {
			logger.error('error in updateImagePrices ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async verifyDiscount(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.verifyDiscountCode(req.body)
			return this.sendSuccess(req, res, 'discount coupon', result)
		} catch (error) {
			logger.error('error in updateImagePrices ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async checkout(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.imageService.checkoutSession(req.body, res.locals.user)
			return this.sendSuccess(req, res, 'discount coupon', result)
		} catch (error) {
			logger.error('error in checkout ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async checkoutWebHook(req: Request, res: Response): Promise<void> {
		try {
			await this.imageService.checkoutSessionCompletion(req.body, req.headers['stripe-signature'] as string)
			return this.sendSuccess(req, res, 'checkout complete')
		} catch (error) {
			logger.error('error in checkout ImageController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}
}
