import Stripe from 'stripe'

import AppConfig from '@/AppConfig'

const appConfig = AppConfig()

export interface IStripeService {
	stripe: Stripe

	createCustomer(email: string, name: string, userId: string): Promise<Stripe.Customer>
	createConnectedAccount(email: string, name: string, userId: string): Promise<Stripe.Account>
	connectedAccountLink(accountId: string): Promise<Stripe.AccountLink>
	connectedAccountDetails(accountId: string): Promise<Stripe.Account>
}

export default class StripeService implements IStripeService {
	stripe: Stripe

	constructor() {
		this.stripe = new Stripe(appConfig.STRIPE_SECRET_KEY, {
			apiVersion: '2022-08-01',
		})
	}

	createCustomer(email: string, name: string, userId: string): Promise<Stripe.Customer> {
		return this.stripe.customers.create({
			email,
			name,
			metadata: {
				userId,
			},
		})
	}

	createConnectedAccount(email: string, name: string, userId: string): Promise<Stripe.Account> {
		return this.stripe.accounts.create({
			email,
			metadata: {
				userId,
				name,
			},
			type: 'standard',
		})
	}

	connectedAccountLink(account: string): Promise<Stripe.AccountLink> {
		return this.stripe.accountLinks.create({
			account,
			type: 'account_onboarding',
			return_url: `${appConfig.APP_URL}/api/users/payout-account-verify`,
			refresh_url: `${appConfig.APP_URL}/api/users/payout-account-link`,
		})
	}

	connectedAccountDetails(accountId: string): Promise<Stripe.Account> {
		return this.stripe.accounts.retrieve({
			stripeAccount: accountId,
		})
	}
}
