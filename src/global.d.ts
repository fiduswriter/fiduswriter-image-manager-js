// Ambient declarations for dependencies without bundled types.

declare module "@fiduswriter/common/common" {
    export function baseBodyTemplate(...args: unknown[]): string
}

declare module "@fiduswriter/common/feedback" {
    export class FeedbackTab {
        init(): void
    }
}

declare module "@fiduswriter/common/menu" {
    export class SiteMenu {
        constructor(app: unknown, section: string)
        init(): void
    }
}

// Globals provided by the Fidus Writer host page.

declare function gettext(msgid: string): string

declare function interpolate(
    fmt: string,
    args: unknown[],
    named?: boolean
): string

declare function staticUrl(path: string): string

declare const settings: Record<string, unknown>

interface Window {
    settings?: Record<string, unknown>
    csrfToken?: string
}
