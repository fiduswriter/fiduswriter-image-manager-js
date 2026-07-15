import {activateWait, addAlert, deactivateWait, gettext, postJson} from "fwtoolkit"

import type {
    Image,
    ImageCategory,
    ImageManagerApp,
    ImagesResponse,
    SaveImageRequest,
    SaveImageResponse
} from "./types.js"

/* A class that holds information about images uploaded by the user. */

export class ImageDB {
    app: ImageManagerApp

    db: Record<number, Image>

    cats: ImageCategory[]

    constructor(app: ImageManagerApp) {
        this.app = app
        this.db = {}
        this.cats = []
    }

    getDB(): Promise<void> {
        this.db = {}
        this.cats = []

        activateWait()

        return postJson("/api/usermedia/images/").then(({json}) => {
            const response = json as ImagesResponse
            this.cats = response.imageCategories
            response.images.forEach(image => {
                this.db[image.id] = image
            })
            deactivateWait()
            return
        })
    }

    saveImage(imageData: SaveImageRequest): Promise<number> {
        activateWait()
        const {image, ...jsonData} = imageData

        return postJson(
            "/api/usermedia/save/",
            jsonData,
            image ? {image} : {}
        )
            .then(({json}) => {
                const response = json as SaveImageResponse
                deactivateWait()
                if (Object.keys(response.errormsg).length) {
                    return Promise.reject(new Error(response.errormsg.error))
                } else {
                    this.db[response.values.id] = response.values
                    return response.values.id
                }
            })
            .catch(error => {
                const networkError = error as {
                    status?: number
                    message?: string
                    statusText?: string
                }
                if (networkError.status === 413) {
                    addAlert(
                        "error",
                        `${gettext("Image is larger than the maximum permitted size")}${this.app.settings?.MEDIA_MAX_SIZE ? `: ${Number.parseInt(String(this.app.settings.MEDIA_MAX_SIZE / 1000000))}MB` : "."}`
                    )
                } else if (networkError.message) {
                    addAlert("error", gettext(networkError.message))
                } else {
                    addAlert("error", gettext(networkError.statusText || ""))
                }
                deactivateWait()
                throw error
            })
    }
}
