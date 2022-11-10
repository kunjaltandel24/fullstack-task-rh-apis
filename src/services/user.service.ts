import { Document, LeanDocument } from 'mongoose'
import { Stripe } from 'stripe'

import IUser from '@/interfaces/IUser'
import Users from '@/models/Users'
import StripeService, { IStripeService } from '@/services/stripe.service'

export interface IUserService {
	stripeService: IStripeService

	userDetails(userId: string): Promise<LeanDocument<IUser>>
	completePayoutAccount(user: IUser & Document): Promise<Stripe.AccountLink>
	verifyPayoutAccount(user: IUser & Document): Promise<boolean>
}

export default class UserService implements IUserService {
	stripeService: IStripeService

	constructor() {
		this.stripeService = new StripeService()
	}

	async userDetails(userId: string): Promise<LeanDocument<IUser>> {
		const user = await Users.findOne({ _id: userId })
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
		return this.stripeService.connectedAccountLink(user.stripeAccountId)
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
}
