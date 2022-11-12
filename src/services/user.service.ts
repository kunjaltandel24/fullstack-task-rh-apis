import bcrypt from 'bcryptjs'
import mongoose, { Document, LeanDocument } from 'mongoose'
import { Stripe } from 'stripe'

import AppConfig from '@/AppConfig'
import IUser from '@/interfaces/IUser'
import logger from '@/logger'
import Users from '@/models/Users'
import StripeService, { IStripeService } from '@/services/stripe.service'
import { generateRandomString, isValidObjectId } from '@/utils'
import { signToken } from '@/utils/jwt'
import mailer from '@/utils/mailer'

const { CLIENT_URL } = AppConfig()

export interface IUserService {
	stripeService: IStripeService

	userDetails(userId: string): Promise<LeanDocument<IUser>>
	completePayoutAccount(user: IUser & Document): Promise<Stripe.AccountLink>
	verifyPayoutAccount(user: IUser & Document): Promise<boolean>
	resendVerificationLink(user: IUser & Document): Promise<boolean>
}

export default class UserService implements IUserService {
	stripeService: IStripeService

	constructor() {
		this.stripeService = new StripeService()
	}

	async userDetails(userId: string): Promise<LeanDocument<IUser>> {
		const queryFilter: mongoose.FilterQuery<IUser> = {}
		if (isValidObjectId(userId)) {
			queryFilter._id = userId
		} else {
			queryFilter.username = userId
		}
		const user = await Users.findOne(queryFilter)
			.select('-password')
			.lean()
			.exec()

		if (!user) {
			throw {
				notFound: true,
				message: 'user not found',
			}
		}
		return user
	}

	async completePayoutAccount(user: IUser & Document): Promise<Stripe.AccountLink> {
		if (!user.stripeAccountId) {
			throw {
				notAllowed: true,
				message: 'please verify your account',
			}
		}
		return this.stripeService.connectedAccountLink(user.stripeAccountId, user.username)
	}

	async verifyPayoutAccount(user: IUser & Document): Promise<boolean> {
		if (!user.stripeAccountId) {
			throw {
				notAllowed: true,
				message: 'please verify your account',
			}
		}
		const stripeAccount = await this.stripeService.connectedAccountDetails(user.stripeAccountId)

		if (!stripeAccount.details_submitted) {
			throw {
				notFound: true,
				message: 'please complete payout account through onboarding',
			}
		}

		user.stripeAccountCompleted = true
		await user.save()

		return true
	}

	async resendVerificationLink(user: IUser & Document): Promise<boolean> {
		if (user.isVerified) {
			throw {
				notAllowed: true,
				message: 'account already verified',
			}
		}

		user.verificationCode = generateRandomString(6)
		await user.save()

		const verificationToken = signToken({
			email: user.email,
			code: bcrypt.hashSync(user.verificationCode, bcrypt.genSaltSync(12)),
		})

		mailer({
			to: user.email,
			subject: 'Account verification',
			body: `verify your account through following link\n${CLIENT_URL}/verify?vt=${verificationToken}`,
		})
			.catch((error) => {
				logger.error('failed to send verification email: ', error)
			})

		return true
	}
}
