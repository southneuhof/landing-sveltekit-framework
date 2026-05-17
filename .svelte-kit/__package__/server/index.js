import { error } from '@sveltejs/kit';
export { reorderEntries } from '../utils/reorder.js';
export function createLandingPageLoad(config) {
    return async function load({ url }) {
        const slugs = url.pathname.split('/').slice(1).filter(Boolean);
        const locale = config.getLocale();
        if (slugs.length === 0)
            throw error(404, 'Page not found');
        const finalWhereClause = buildNestedSlugWhere(slugs);
        const targetMenuItem = await config.prisma.menuItem.findFirst({
            where: finalWhereClause,
            include: {
                page: {
                    include: {
                        translations: {
                            where: { language: locale, status_code: 'PUBLISHED' },
                            include: { sectionGroups: true },
                        },
                    },
                },
                translations: {
                    where: { language: locale },
                },
            },
        });
        if (!targetMenuItem?.page?.[0]?.translations?.[0]) {
            throw error(404, 'Page or translation not found for this path and locale');
        }
        const pageTranslation = targetMenuItem.page[0].translations[0];
        const currentPageSectionGroup = pageTranslation?.sectionGroups?.[0]?.id || null;
        if (!currentPageSectionGroup) {
            throw error(500, 'Section group not found for this page translation');
        }
        const pageSectionGroup = await config.prisma.sectionGroup.findUnique({
            where: { id: currentPageSectionGroup },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                },
            },
        });
        if (!pageSectionGroup)
            throw error(500, 'Section group not found');
        const sections = await hydrateSections(pageSectionGroup.sections, config.sectionLoaders ?? {});
        return { sections };
    };
}
export function createRootLayoutLoad(config) {
    return async function load() {
        const locale = config.getLocale();
        const menu = await config.prisma.menuItem.findMany({
            where: { level: 1 },
            orderBy: { order: 'asc' },
            select: {
                menu_item_type: true,
                visible: true,
                url: true,
                slug: true,
                show_submenu_below_navbar: true,
                translations: {
                    where: { language: locale },
                    select: { id: true, name: true, description: true },
                },
            },
        });
        return { menu };
    };
}
export function buildNestedSlugWhere(slugs) {
    const finalWhereClause = { slug: slugs[slugs.length - 1] };
    let currentNestedParent = finalWhereClause;
    for (let i = slugs.length - 2; i >= 0; i--) {
        currentNestedParent.parent = { slug: slugs[i] };
        currentNestedParent = currentNestedParent.parent;
    }
    currentNestedParent.parent_id = null;
    return finalWhereClause;
}
async function hydrateSections(sections, loaders) {
    return Promise.all(sections.map(async (section) => {
        if (!section.section_type_code)
            return section;
        const loader = loaders[section.section_type_code];
        let data = null;
        if (loader) {
            try {
                data = await loader(section);
            }
            catch (loaderError) {
                console.error(`Error loading data for section ${section.id} (${section.section_type_code}):`, loaderError);
            }
        }
        return { ...section, data };
    }));
}
