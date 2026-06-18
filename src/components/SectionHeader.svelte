<script lang="ts">
  const {
    header,
    defaultAlign = 'left',
    titleSize = '3xl',
    swapTitlePosition = false,
    learnMoreText = 'Learn more',
  } = $props<{
    header: Record<string, any>;
    defaultAlign?: 'left' | 'center';
    titleSize?: 'xl' | '2xl' | '3xl';
    swapTitlePosition?: boolean;
    learnMoreText?: string;
  }>();

  const defaultAlignClassMap: Record<string, string> = {
    left: 'items-start justify-start text-start',
    center: 'items-center justify-center text-center',
  };

  const titleSizeClassMap: Record<string, string> = {
    xl: 'text-lg md:text-xl',
    '2xl': 'text-xl md:text-2xl',
    '3xl': 'text-2xl md:text-3xl',
  };
</script>

{#if header.subtitle || header.title || header.description}
  <div class="flex flex-col md:flex-row md:items-center gap-y-base {header.url ? 'justify-between' : defaultAlign === 'center' ? 'justify-center' : 'justify-start'} w-full">
    <div class="flex flex-col {titleSize === '3xl' ? 'gap-sm' : 'gap-xs'} {header.url ? defaultAlignClassMap.left : defaultAlignClassMap[defaultAlign]}">
      <div class="flex flex-col gap-xs">
        {#if !swapTitlePosition}
          {#if header.subtitle}<p class="text-sm">{header.subtitle}</p>{/if}
          {#if header.title}<p class="{titleSizeClassMap[titleSize]} font-bold ">{header.title}</p>{/if}
        {:else}
          {#if header.title}<p class="{titleSizeClassMap[titleSize]} font-bold ">{header.title}</p>{/if}
          {#if header.subtitle}<p class="text-sm">{header.subtitle}</p>{/if}
        {/if}
      </div>
      {#if header.description}<p class="rtf-content m-base text-sm text-outline">{@html header.description}</p>{/if}
    </div>
    {#if header.url}
      <div class="flex flex-row items-center gap-sm flex-shrink-0">
        <a href={header.url} class="font-semibold underline">{header.url_text || learnMoreText}</a>
        <i class="ri-arrow-right-line"></i>
      </div>
    {/if}
  </div>
{/if}
