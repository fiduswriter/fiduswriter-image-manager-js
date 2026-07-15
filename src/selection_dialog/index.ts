import {Dialog, SelectionDataTable, cancelPromise, escapeText, gettext} from "fwtoolkit"
import type {DialogButtonSpec} from "fwtoolkit/basic"
import type {DataTable} from "simple-datatables"

import type {ImageDB} from "../database.js"
import type {
    ImageManagerPage,
    ImageSelectionItem
} from "../types.js"

export class ImageSelectionDialog {
    imageDB: ImageDB

    userImageDB: ImageDB

    page: ImageManagerPage

    imgId: number | false

    imgDb: "document" | "user" = "document"

    images: ImageSelectionItem[] = []

    imageDialog!: Dialog

    selectionTable!: SelectionDataTable

    table: DataTable | null = null

    constructor(
        imageDB: ImageDB,
        userImageDB: ImageDB,
        imgId: number | false,
        page: ImageManagerPage
    ) {
        this.imageDB = imageDB
        this.userImageDB = userImageDB
        this.page = page
        this.imgId = imgId // a preselected image
        // the preselection image will always come from the document
        this.images = [] // images from both databases
    }

    isE2EE(): boolean {
        return this.page.e2ee?.encrypted === true
    }

    init(): Promise<unknown> {
        console.log(
            "DEBUG selection init: docImages=",
            Object.keys(this.imageDB.db).length,
            "userImages=",
            Object.keys(this.userImageDB.db).length
        )
        this.images = Object.values(this.imageDB.db).map(image => ({
            image,
            db: "document" as const
        }))
        Object.values(this.userImageDB.db).forEach(image => {
            if (this.imageDB.db[image.id]) {
                return
            }
            this.images.push({
                image,
                db: "user" as const
            })
        })
        console.log("DEBUG selection images=", this.images.length)
        const buttons: DialogButtonSpec[] = []
        const p = new Promise(resolve => {
            if (!this.page.app.isOffline()) {
                buttons.push({
                    text: gettext("Add new image"),
                    icon: "plus-circle",
                    click: () => {
                        import("../edit_dialog/index.js").then(
                            ({ImageEditDialog}) => {
                                const targetDB = this.isE2EE()
                                    ? this.imageDB
                                    : this.userImageDB
                                const imageUpload = new ImageEditDialog(
                                    targetDB,
                                    false,
                                    this.page
                                )

                                resolve(
                                    imageUpload.init().then(imageId => {
                                        console.log(
                                            "DEBUG upload resolved imageId=",
                                            imageId
                                        )
                                        this.imgId = imageId || false
                                        // For E2EE docs the image goes straight
                                        // into the document DB, not the user's.
                                        this.imgDb = this.isE2EE()
                                            ? "document"
                                            : "user"
                                        console.log(
                                            "DEBUG closing selection dialog"
                                        )
                                        this.imageDialog.close()
                                        console.log(
                                            "DEBUG reinit selection dialog"
                                        )
                                        return this.init()
                                    })
                                )
                            }
                        )
                    }
                })
            }

            buttons.push({
                text: gettext("Use image"),
                classes: "fw-dark",
                click: () => {
                    this.imageDialog.close()
                    resolve({id: this.imgId, db: this.imgDb})
                }
            })

            buttons.push({
                type: "cancel" as const,
                click: () => {
                    this.imageDialog.close()
                    resolve(cancelPromise())
                }
            })
        })
        this.imageDialog = new Dialog({
            buttons,
            width: 300,
            body: '<div class="image-selection-table"></div>',
            title: gettext("Images"),
            id: "select-image-dialog"
        })
        this.imageDialog.open()
        this.initTable()
        this.imageDialog.centerDialog()
        return p
    }

    initTable(): void {
        /* Initialize the overview table */
        const tableEl = document.createElement("table")
        tableEl.classList.add("fw-data-table")
        tableEl.classList.add("fw-small")
        const host = this.imageDialog.dialogEl.querySelector(
            "div.image-selection-table"
        ) as HTMLElement | null
        if (!host) {
            return
        }
        host.innerHTML = ""
        host.appendChild(tableEl)

        const selectedIds =
            this.imgId === false ? [] : [`${this.imgDb}-${this.imgId}`]

        this.selectionTable = new SelectionDataTable({
            dom: host,
            classes: ["fw-data-table", "fw-small"],
            columns: [
                {
                    select: 0,
                    hidden: true
                },
                {
                    select: [0, 2],
                    type: "string"
                },
                {
                    select: [1, 3],
                    sortable: false
                }
            ],
            data: this.images.map(image => this.createTableRow(image)),
            idColumn: 0,
            multiple: false,
            selectedIds,
            scrollY: "270px",
            labels: {
                noRows: gettext("No images available"), // Message shown when there are no images
                noResults: gettext("No images found"), // Message shown when no images are found after search
                placeholder: gettext("Search...") // placeholder for search field
            },
            onChange: selected => {
                if (selected.length) {
                    const [db, id] = String(selected[0]).split("-")
                    this.imgId = Number.parseInt(id)
                    this.imgDb = db as "document" | "user"
                } else {
                    this.imgId = false
                }
            }
        })
        this.selectionTable.init()
        this.table = this.selectionTable.table!
    }

    createTableRow(image: ImageSelectionItem): [string, string, string] {
        return [
            `${image.db}-${image.image.id}`,
            image.image.thumbnail === undefined
                ? `<img src="${image.image.image}" style="max-heigth:30px;max-width:30px;">`
                : `<img src="${image.image.thumbnail}" style="max-heigth:30px;max-width:30px;">`,
            escapeText(image.image.title)
        ]
    }
}
