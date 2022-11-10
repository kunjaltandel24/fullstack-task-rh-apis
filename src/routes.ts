import { join } from 'path'

import { Application, Router } from 'express'
import mongoose from 'mongoose'

import AuthController, { IAuthController } from '@/controllers/auth.controller'
import ImageController, { IImageController } from '@/controllers/image.controller'
import UserController, { IUserController } from '@/controllers/user.controller'
import IImage from '@/interfaces/IImage'
import Images from '@/models/Images'

class Routes {
	router: Router

	authController: IAuthController

	imageController: IImageController

	userController: IUserController

	constructor() {
		this.router = Router()
		this.authController = new AuthController()
		this.imageController = new ImageController()
		this.userController = new UserController()
	}

	setup(app: Application) {
		this.router.get('/health-check', (req, res) => {
			res.send({ ok: true })
		})

		this.router.use('/auth', this.authController.router)
		this.router.use('/images', this.imageController.router)
		this.router.use('/users', this.userController.router)

		app.get('/uploads/:image', AuthController.UserAuthMiddleware(true), async (req, res) => {
			try {
				const condition: mongoose.FilterQuery<IImage> = {
					$or: [{ isPublic: true }],
				}
				if (res.locals.user) {
					condition.$or?.push({ user: res.locals.user._id })
				}
				const image = await Images.count({ url: req.params.image, ...condition })
				if (image) {
					return res.sendFile(join(__dirname, `../uploads/${req.params.image}`))
				}
				return res.status(401).send('private image')
			} catch (e) {
				return res.status(500).send('internal server error')
			}
		})

		app.use('/api/', this.router)
	}
}

export default Routes
