import Cropper from "cropperjs"

import {gettext} from "fwtoolkit"
import type {ContentMenuInit} from "fwtoolkit/content_menu"
import type {Dialog as FwDialog} from "fwtoolkit/dialog"

import {CopyrightDialog} from "../copyright_dialog/index.js"
import type {ImageEditDialog} from "./index.js"

let mediaPreviewerImg: HTMLImageElement | false = false

export const imageEditModel = (): ContentMenuInit => ({
    content: [
        {
            title: gettext("Rotate Left"),
            type: "action",
            tooltip: gettext("Rotate-left"),
            order: 0,
            action: (dialog: unknown) => {
                const d = dialog as ImageEditDialog
                const mediaPreviewer = d.mediaPreviewer as
                    | (HTMLElement & {
                        currentStyle?: CSSStyleDeclaration
                    })
                    | undefined
                if (!mediaPreviewer) {
                    return
                }
                const mediaPreviewerStyle =
                    mediaPreviewer.currentStyle ||
                    window.getComputedStyle(
                        mediaPreviewer,
                        false as unknown as string | null
                    )
                rotateBase64Image(
                    mediaPreviewerStyle.backgroundImage
                        .slice(4, -1)
                        .replace(/"/g, ""),
                    d.mediaInput!.type,
                    "left"
                ).then(response =>
                    d.mediaPreviewer!.setAttribute(
                        "style",
                        `background-image: url(${response});`
                    )
                )
                if (d.rotation === 0) {
                    d.rotation = 270
                } else {
                    d.rotation -= 90
                }
            },
            disabled: (dialog: unknown) => !!(dialog as ImageEditDialog).imageId,
            icon: "redo fa-rotate-180"
        },
        {
            title: gettext("Rotate Right"),
            type: "action",
            tooltip: gettext("Rotate-right"),
            order: 1,
            action: (dialog: unknown) => {
                const d = dialog as ImageEditDialog
                const mediaPreviewer = d.mediaPreviewer as
                    | (HTMLElement & {
                        currentStyle?: CSSStyleDeclaration
                    })
                    | undefined
                if (!mediaPreviewer) {
                    return
                }
                const mediaPreviewerStyle =
                    mediaPreviewer.currentStyle ||
                    window.getComputedStyle(
                        mediaPreviewer,
                        false as unknown as string | null
                    )
                rotateBase64Image(
                    mediaPreviewerStyle.backgroundImage
                        .slice(4, -1)
                        .replace(/"/g, ""),
                    d.mediaInput!.type,
                    "right"
                ).then(response =>
                    d.mediaPreviewer!.setAttribute(
                        "style",
                        `background-image: url(${response});`
                    )
                )
                if (d.rotation === 270) {
                    d.rotation = 0
                } else {
                    d.rotation += 90
                }
            },
            disabled: (dialog: unknown) => !!(dialog as ImageEditDialog).imageId,
            icon: "undo"
        },
        {
            title: gettext("Crop"),
            type: "action",
            tooltip: gettext("Crop image"),
            order: 2,
            action: (dialog: unknown) => {
                const d = dialog as ImageEditDialog
                const mediaPreviewer = d.mediaPreviewer as
                    | (HTMLElement & {
                        currentStyle?: CSSStyleDeclaration
                    })
                    | undefined
                if (!mediaPreviewer) {
                    return
                }
                const mediaPreviewerStyle =
                    mediaPreviewer.currentStyle ||
                    window.getComputedStyle(
                        mediaPreviewer,
                        false as unknown as string | null
                    )
                //const base64data = mediaPreviewerStyle.backgroundImage.slice(4, -1).replace(/"/g, "")
                mediaPreviewerImg = document.createElement("img")
                //img.src = `url(${base64data})`
                mediaPreviewerImg.src = mediaPreviewerStyle.backgroundImage
                    .slice(4, -1)
                    .replace(/"/g, "")
                d.mediaPreviewer!.parentElement!.replaceChild(
                    mediaPreviewerImg,
                    d.mediaPreviewer!
                )
                const cropper = new Cropper(mediaPreviewerImg, {
                    viewMode: 1,
                    responsive: true
                })
                toggleCropMode(true, d, cropper)
            },
            disabled: (dialog: unknown) => !!(dialog as ImageEditDialog).imageId,
            icon: "crop"
        },
        {
            title: gettext("Set Copyright"),
            type: "action",
            tooltip: gettext("Specify copyright information"),
            order: 3,
            action: (dialog: unknown) => {
                const d = dialog as ImageEditDialog
                const crDialog = new CopyrightDialog(d.copyright)
                crDialog.init().then(copyright => {
                    if (copyright) {
                        d.copyright = copyright
                    }
                })
            }
        }
    ]
})

let oldButtons: FwDialog["buttons"] | false = false

const toggleCropMode = (val: boolean, dialog: ImageEditDialog, cropper: Cropper) => {
    if (!dialog.dialog) {
        return
    }
    const dialogEl = dialog.dialog
    if (val && !oldButtons) {
        dialog.mediaPreviewerDiv!.classList.add("crop-mode")
        oldButtons = dialogEl.buttons
        dialogEl.setButtons([
            {
                text: gettext("Crop"),
                click: () => {
                    dialog.mediaPreviewer!.setAttribute(
                        "style",
                        `background-image: url(${cropper
                            .getCroppedCanvas()
                            .toDataURL(dialog.mediaInput!.type)});`
                    )
                    dialog.cropped = true
                    cropper.destroy()
                    toggleCropMode(false, dialog, cropper)
                },
                classes: "fw-dark"
            },
            {
                type: "cancel",
                classes: "fw-orange",
                click: () => {
                    cropper.destroy()
                    toggleCropMode(false, dialog, cropper)
                }
            }
        ])
    } else {
        dialog.mediaPreviewerDiv!.classList.remove("crop-mode")
        if (mediaPreviewerImg) {
            mediaPreviewerImg.parentElement!.replaceChild(
                dialog.mediaPreviewer!,
                mediaPreviewerImg
            )
            mediaPreviewerImg = false
        }
        if (oldButtons) {
            dialogEl.buttons = oldButtons
            oldButtons = false
        }
    }
    dialogEl.refreshButtons()
    dialogEl.centerDialog()
}

const rotateBase64Image = (
    base64data: string,
    type: string,
    direction: "left" | "right"
): Promise<string> => {
    return new Promise(resolve => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!
        const image = new Image()
        image.src = base64data
        image.onload = () => {
            canvas.height = image.width
            canvas.width = image.height
            if (direction == "left") {
                ctx.rotate((90 * Math.PI) / 180)
                ctx.translate(0, -canvas.width)
            } else {
                ctx.rotate((-90 * Math.PI) / 180)
                ctx.translate(-canvas.height, 0)
            }
            ctx.drawImage(image, 0, 0)
            resolve(canvas.toDataURL(type))
        }
    })
}
