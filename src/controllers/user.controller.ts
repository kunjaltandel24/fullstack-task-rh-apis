import {
	Request, Response, Router,
} from 'express'

import AuthController from '@/controllers/auth.controller'
import logger from '@/logger'
import UserService, { IUserService } from '@/services/user.service'
import ApiResponse from '@/utils/apiResponse'
import { CustomError } from '@/utils/CustomTypes'

export interface IUserController {
	router: Router
	userService: IUserService

	userDetails(req: Request, res: Response): Promise<void>
	completePayoutAccount(req: Request, res: Response): Promise<void>
	verifyPayoutAccount(req: Request, res: Response): Promise<void>
	withdraw(req: Request, res: Response): Promise<void>
	resendVerification(req: Request, res: Response): Promise<void>
}

export default class UserController extends ApiResponse implements IUserController {
	router: Router

	userService: IUserService

	constructor() {
		super()
		this.userService = new UserService()
		this.router = Router()

		this.router.get('/payout-account-link', AuthController.UserAuthMiddleware(), this.completePayoutAccount)
		this.router.get('/payout-account-verify', AuthController.UserAuthMiddleware(), this.verifyPayoutAccount)
		this.router.post('/withdraw', AuthController.UserAuthMiddleware(), this.withdraw)
		this.router.get('/resend-verification', AuthController.UserAuthMiddleware(), this.resendVerification)
		this.router.get('/:userId', this.userDetails)
	}

	async userDetails(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.userService.userDetails(req.params.userId)
			return this.sendSuccess(req, res, 'public images', result)
		} catch (error) {
			logger.error('error in login UserController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async completePayoutAccount(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.userService.completePayoutAccount(res.locals.user)
			return this.sendSuccess(req, res, 'payout account link', result)
		} catch (error) {
			logger.error('error in login UserController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async verifyPayoutAccount(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.userService.verifyPayoutAccount(res.locals.user)
			return this.sendSuccess(req, res, 'payout account verified', result)
		} catch (error) {
			logger.error('error in login UserController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async withdraw(req: Request, res: Response): Promise<void> {
		try {
			return this.sendSuccess(req, res, 'withdraw done')
		} catch (error) {
			logger.error('error in login UserController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}

	async resendVerification(req: Request, res: Response): Promise<void> {
		try {
			await this.userService.resendVerificationLink(res.locals.user)
			return this.sendSuccess(req, res, 'verification link sent')
		} catch (error) {
			logger.error('error in resendVerification UserController method', error)
			return this.sendCustomError(req, res, error as CustomError)
		}
	}
}
