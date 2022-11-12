import Stripe from 'stripe'

import AppConfig from '@/AppConfig'

const appConfig = AppConfig()

export interface IStripeService {
	stripe: Stripe

	createCustomer(email: string, name: string, userId: string): Promise<Stripe.Customer>
	createConnectedAccount(email: string, name: string, userId: string): Promise<Stripe.Account>
	connectedAccountLink(accountId: string, username: string): Promise<Stripe.AccountLink>
	connectedAccountDetails(accountId: string): Promise<Stripe.Account>
	createProductWithPrice(name: string, price: number, imageId: string): Promise<Stripe.Product>
	createPrice(productId: string, price: number): Promise<Stripe.Price>
	checkDiscountCode(discountCode: string): Promise<Stripe.Coupon>
	checkoutSessionLink(
		items: { price: string, quantity: number }[],
		clientCurrentUrl: string,
		customer: string,
		buyer: string,
		imageId: string[],
		transfer_group: string,
		discountCode?: string,
	): Promise<Stripe.Checkout.Session>
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

	connectedAccountLink(account: string, username: string): Promise<Stripe.AccountLink> {
		return this.stripe.accountLinks.create({
			account,
			type: 'account_onboarding',
			return_url: `${appConfig.CLIENT_URL}/user/${username}?onb=complete`,
			refresh_url: `${appConfig.CLIENT_URL}/user/${username}?onb=refreshed`,
		})
	}

	connectedAccountDetails(accountId: string): Promise<Stripe.Account> {
		return this.stripe.accounts.retrieve({
			stripeAccount: accountId,
		})
	}

	createProductWithPrice(name: string, price: number, imageId: string): Promise<Stripe.Product> {
		return this.stripe.products.create({
			name,
			default_price_data: {
				unit_amount: price * 100,
				currency: 'usd',
			},
			metadata: { imageId },
			expand: ['default_price'],
		})
	}

	createPrice(productId: string, price: number): Promise<Stripe.Price> {
		return this.stripe.prices.create({
			product: productId,
			unit_amount: price * 100,
			currency: 'usd',
		})
	}

	checkDiscountCode(discountCode: string): Promise<Stripe.Coupon> {
		return this.stripe.coupons.retrieve(discountCode)
	}

	checkoutSessionLink(
		items: { price: string, quantity: number }[],
		clientCurrentUrl: string,
		customer: string,
		buyer: string,
		imageIds: string[],
		transfer_group: string,
		discountCode?: string,
	): Promise<Stripe.Checkout.Session> {
		const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
		if (discountCode) {
			discounts.push({
				coupon: discountCode,
			})
		}
		return this.stripe.checkout.sessions.create({
			line_items: items,
			metadata: {
				buyer,
				imageIds: JSON.stringify(imageIds),
				transfer_group,
			},
			currency: 'usd',
			mode: 'payment',
			customer,
			payment_intent_data: {
				capture_method: 'automatic',
				transfer_group,
			},
			discounts,
			success_url: `${appConfig.CLIENT_URL}${clientCurrentUrl}?checkout=complete`,
			cancel_url: `${appConfig.CLIENT_URL}${clientCurrentUrl}?checkout=cancelled`,
		})
	}
}
