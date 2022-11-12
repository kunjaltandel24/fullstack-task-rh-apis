import resemble from 'node-resemble-js'

const imageDiff = async (img1: string, img2: string): Promise<number> => new Promise((resolve) => {
	resemble(img1)
		.compareTo(img2)
		.onComplete((result: { misMatchPercentage: string }) => {
			resolve(Number(result.misMatchPercentage))
		})
})

export default imageDiff
