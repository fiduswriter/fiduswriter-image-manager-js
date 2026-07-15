import {CheckableList, ContentMenu, Dialog, addAlert, gettext} from "fwtoolkit"
import type {CheckableListOptions} from "fwtoolkit"
import type {ContentMenuInit} from "fwtoolkit/content_menu"
import {E2EEEncryptor} from "fwtoolkit/e2ee/encryptor"

import {imageEditModel} from "./model.js"
import {imageEditTemplate} from "./templates.js"
import type {ImageDB} from "../database.js"
import type {
    Copyright,
    Image,
    ImageCategory,
    ImageManagerPage,
    SaveImageRequest
} from "../types.js"

export class ImageEditDialog {
    imageDB: ImageDB

    page: ImageManagerPage

    imageId: number | false

    dialog: Dialog | false = false

    copyright: Copyright

    menu: ContentMenuInit

    catsList: CheckableList | {value: (string | number)[]} = {value: []}

    mediaPreviewerDiv?: HTMLElement

    mediaPreviewer?: HTMLElement

    rotation = 0

    cropped = false

    mediaInput?: File

    constructor(imageDB: ImageDB, imageId: number | false = false, page: ImageManagerPage) {
        this.imageDB = imageDB
        this.page = page
        this.imageId = imageId
        this.copyright = this.imageId
            ? this.imageDB.db[this.imageId].copyright
            : {
                  holder: false,
                  year: false,
                  freeToRead: true,
                  licenses: []
              }
        this.menu =
            (this.page.menu as {imageEditModel?: ContentMenuInit} | undefined)
                ?.imageEditModel || imageEditModel()
    }

    //open a dialog for uploading an image
    init(): Promise<number | void> {
        if (this.page.app.isOffline()) {
            this.showOffline()
            return Promise.resolve()
        }
        const returnPromise = new Promise<number | void>(resolve => {
            let dialog: Dialog
            dialog = new Dialog({
                title: this.imageId
                    ? gettext("Update Image Information")
                    : gettext("Upload Image"),
                id: "editimage",
                classes: "fw-media-uploader",
                body: imageEditTemplate({
                    image: this.imageId ? this.imageDB.db[this.imageId] : false,
                    cats: this.imageDB.cats
                }),
                buttons: [
                    {
                        text: this.imageId
                            ? gettext("Update")
                            : gettext("Upload"),
                        click: () => resolve(this.saveImage()),
                        classes: "fw-dark"
                    },
                    {
                        type: "cancel",
                        classes: "fw-orange",
                        click: () => dialog.close()
                    }
                ]
            })
            this.dialog = dialog
            dialog.open()
        })

        const image: Image | false = this.imageId
            ? this.imageDB.db[this.imageId]
            : false
        const catsEl = document.getElementById("image-edit-categories")
        if (catsEl) {
            const checkableOptions: CheckableListOptions = {
                dom: catsEl,
                options: this.imageDB.cats.map((cat: ImageCategory) => ({
                    id: cat.id,
                    label: cat.category_title
                })),
                initialValue: image ? image.cats : [],
                multiple: true
            }
            this.catsList = new CheckableList(checkableOptions)
        } else {
            this.catsList = {value: []}
        }

        if (!this.imageId) {
            this.bindMediaUploadEvents()
        }

        const figureEditMenu = document.querySelector(".figure-edit-menu")
        if (figureEditMenu) {
            figureEditMenu.addEventListener("click", event => {
                event.preventDefault()
                event.stopImmediatePropagation()

                const contentMenu = new ContentMenu({
                    menu: this.menu,
                    width: 220,
                    page: this,
                    menuPos: {X: (event as MouseEvent).pageX - 50, Y: (event as MouseEvent).pageY + 50}
                })
                contentMenu.open()
            })
        }

        return returnPromise
    }

    //add image upload events
    bindMediaUploadEvents(): void {
        const selectButton = document.querySelector(
                "#editimage .fw-media-select-button"
            ) as HTMLButtonElement | null,
            mediaInputSelector = document.querySelector(
                "#editimage .fw-media-file-input"
            ) as HTMLInputElement | null
        this.mediaPreviewerDiv = document.querySelector(
            "#editimage .figure-preview > div"
        ) as HTMLElement | null || undefined
        this.rotation = 0
        this.cropped = false

        if (!selectButton || !mediaInputSelector || !this.mediaPreviewerDiv) {
            return
        }

        selectButton.addEventListener("click", () => {
            mediaInputSelector.click()
        })

        const dialog = this.dialog
        if (!dialog) {
            return
        }

        mediaInputSelector.addEventListener("change", () => {
            this.mediaInput = mediaInputSelector.files![0]
            const fr = new window.FileReader()
            fr.onload = () => {
                this.mediaPreviewerDiv!.innerHTML = `<div class="img" style="background-image: url(${fr.result});" />`
                this.mediaPreviewer =
                    this.mediaPreviewerDiv!.querySelector(".img") || undefined
                this.mediaPreviewerDiv!.classList.remove("crop-mode")
                dialog.centerDialog()
            }
            fr.readAsDataURL(this.mediaInput)
        })
    }

    displayCreateImageError(errors: Record<string, string>): void {
        Object.keys(errors).forEach(eKey => {
            const eMsg = `<div class="fw-warning">${errors[eKey]}</div>`
            if ("error" == eKey) {
                document
                    .getElementById("editimage")!
                    .insertAdjacentHTML("afterbegin", eMsg)
            } else {
                const fieldEl = document.getElementById(`id_${eKey}`)
                if (fieldEl) {
                    fieldEl.insertAdjacentHTML("afterend", eMsg)
                }
            }
        })
    }

    async saveImage(): Promise<number | void> {
        const titleInput = document.querySelector(
            "#editimage .fw-media-title"
        ) as HTMLInputElement | null
        const imageData: SaveImageRequest = {
            title: titleInput ? titleInput.value : "",
            copyright: this.copyright,
            cats: this.catsList.value
        }
        if (this.imageId) {
            imageData.id = this.imageId
        } else if (!this.rotation && !this.cropped && this.mediaInput) {
            imageData.image = this.mediaInput
        } else if (this.mediaPreviewer && this.mediaInput) {
            const mediaPreviewer = this.mediaPreviewer as HTMLElement & {
                currentStyle?: CSSStyleDeclaration
            }
            const mediaPreviewerStyle =
                mediaPreviewer.currentStyle ||
                window.getComputedStyle(
                    mediaPreviewer,
                    false as unknown as string | null
                )
            const base64data = mediaPreviewerStyle.backgroundImage
                .slice(4, -1)
                .replace(/"/g, "")
            const bstr = atob(base64data.split(",")[1])
            let n = bstr.length
            const u8arr = new Uint8Array(n)
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n)
            }
            imageData.image = new File([u8arr], this.mediaInput.name, {
                type: this.mediaInput.type
            })
        }

        // For E2EE documents, encrypt the image and copyright before uploading
        const isE2EE = this.page.e2ee?.encrypted === true
        if (isE2EE && imageData.image) {
            imageData.image = await E2EEEncryptor.encryptImage(
                imageData.image as File | Blob,
                this.page.e2ee!.key
            )
            imageData.original_file_type = this.mediaInput?.type || "image/png"
            // Encrypt copyright metadata so the server cannot read it
            imageData.copyright = await E2EEEncryptor.encryptObject(
                imageData.copyright,
                this.page.e2ee!.key
            )
        }

        // Remove old warning messages
        document
            .querySelectorAll("#editimage .fw-warning")
            .forEach(el => el.parentElement!.removeChild(el))
        return new Promise<number | void>(resolve => {
            const dialog = this.dialog
            this.imageDB.saveImage(imageData).then(
                imageId => {
                    if (dialog) {
                        dialog.close()
                    }
                    addAlert("success", gettext("The image has been updated."))
                    this.imageId = imageId
                    resolve(imageId)
                },
                errors => {
                    if (this.page.app.isOffline()) {
                        this.showOffline()
                        return
                    }
                    this.displayCreateImageError(errors as Record<string, string>)
                    addAlert(
                        "error",
                        gettext(
                            "Some errors were found. Please examine the form."
                        )
                    )
                }
            )
        })
    }

    showOffline(): void {
        addAlert(
            "info",
            gettext(
                "You are currently offline. Please try again after going online."
            )
        )
    }
}
