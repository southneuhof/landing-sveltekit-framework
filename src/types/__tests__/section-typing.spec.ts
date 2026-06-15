import { describe, expect, it } from 'vitest'
import { defineSectionSchema, type LandingSectionForSchema } from '../index.js'

const contentDefaultSchema = defineSectionSchema({
  code: 'content-default',
  meta: {
    fields: ['width_preset'] as const,
  },
  render: {
    wrapper: {
      overflow: 'hidden',
    },
    resolveWrapper: ({ section }) => ({
      overflow: section.meta?.width_preset === 'full' ? 'visible' : 'clip-x',
    }),
  },
  data: {
    content: {
      type: 'content',
      order: 1,
      fields: ['title', 'description'] as const,
    },
  },
})

const contentGallerySchema = defineSectionSchema({
  code: 'content-gallery',
  data: {
    content: { type: 'content', order: 1, fields: ['title'] as const },
    gallery: { type: 'gallery', order: 2, many: true, fields: ['media'] as const },
  },
})

const dataListSchema = defineSectionSchema({
  code: 'data-list',
  data: {
    childSections: {
      type: 'sectionGroup',
      order: 1,
      many: true,
      schema: {
        data: {
          gallery: {
            type: 'gallery',
            order: 1,
            fields: ['title', 'attachment'] as const,
          },
        },
      },
    },
  },
})

describe('LandingSectionForSchema typing', () => {
  it('infers many gallery as arrays and content as nullable object', () => {
    type GallerySection = LandingSectionForSchema<typeof contentGallerySchema>
    type GallerySlot = GallerySection['data']['gallery']
    type ContentSlot = GallerySection['data']['content']

    const galleryCheck: GallerySlot = []
    const contentCheck: ContentSlot = null

    expect(Array.isArray(galleryCheck)).toBe(true)
    expect(contentCheck).toBeNull()
  })

  it('infers meta keys from schema meta.fields', () => {
    type ContentSection = LandingSectionForSchema<typeof contentDefaultSchema>
    type Meta = ContentSection['meta']

    const okMeta: Meta = { width_preset: 'md' }
    expect(okMeta.width_preset).toBe('md')

    // @ts-expect-error unknown meta key
    const invalidMeta: Meta = { not_a_meta_field: 'x' }
    expect(invalidMeta).toBeDefined()
  })

  it('infers slot keys and slot field keys', () => {
    type ContentSection = LandingSectionForSchema<typeof contentDefaultSchema>

    const okSectionData: ContentSection['data'] = {
      content: { title: 'Hello' },
    }
    expect(okSectionData.content?.title).toBe('Hello')

    // @ts-expect-error unknown slot
    const invalidSlotData: ContentSection['data'] = { unknownSlot: {} }
    expect(invalidSlotData).toBeDefined()

    // @ts-expect-error unknown content field
    const invalidFieldData: ContentSection['data'] = { content: { not_a_field: 'x' } }
    expect(invalidFieldData).toBeDefined()
  })

  it('includes nested slot fields in slot field keys', () => {
    type DataListSection = LandingSectionForSchema<typeof dataListSchema>
    type NestedItem = NonNullable<DataListSection['data']['childSections']>[number]

    const item: NestedItem = {
      id: 'n1',
      meta: {},
      data: {
        gallery: {
          title: 'A',
          attachment: 'logo.png',
        },
      },
    }

    expect(item.data.gallery?.attachment).toBe('logo.png')
  })

  it('accepts schema-driven wrapper render config', () => {
    expect(contentDefaultSchema.render?.wrapper?.overflow).toBe('hidden')
    expect(contentDefaultSchema.render?.resolveWrapper?.({
      section: {
        id: 'section-1',
        meta: { width_preset: 'full' },
      },
    }).overflow).toBe('visible')
    expect(contentDefaultSchema.render?.resolveWrapper?.({
      section: {
        id: 'section-2',
        meta: { width_preset: 'md' },
      },
    }).overflow).toBe('clip-x')
  })
})
