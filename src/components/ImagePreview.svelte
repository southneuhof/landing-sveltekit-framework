<script lang="ts">
  import { Dialog, Label, Separator } from "bits-ui";
  
  const {
    src,
    alt,
    title, 
    description,
    subtitle,
    trigger,
    hideTextOnPreview,
    ...restProps
  } = $props<{
    src?: string,
    alt?: string,
    title?: string,
    description?: string,
    trigger?: () => any,
    hideTextOnPreview?: boolean,
    [key: string]: any
  }>()
</script>

<Dialog.Root>
  <Dialog.Trigger class={restProps.class} type="button">
    {#if !trigger }
      <div class="text-surface text-shadow-outline-variant bg-center h-full bg-cover flex flex-col text-start items-start group/item justify-end p-6 rounded-sm" style="background-image: {((title || description || subtitle) && !hideTextOnPreview) ? `linear-gradient(to top, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0) 50%), ` : ``} url('{src}');">
        {#if !hideTextOnPreview}
        <!-- {#if description}<p class="text-sm translate-y-5 group-hover/item:translate-y-0 transition-all rtf-content m-base text-start">{@html description}</p>{/if} -->
          <p class="text-xs">{subtitle}</p>
          <p class="font-semibold translate-y-5 group-hover/item:translate-y-0 transition-all">{title}</p>
          <p class="text-xs mt-2 opacity-0 translate-y-5 transition-all group-hover/item:opacity-100 group-hover/item:translate-y-0"><i class="ri-arrow-right-up-line"></i></p>
        {/if}
      </div>
    {:else}
      {@render trigger()}
    {/if}
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[100] bg-black/80"
    />
    <Dialog.Content
      class="bg-transparent flex items-center justify-center top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 h-fit data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-0 w-full md:w-fit z-[100] p-4 sm:p-6 md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] md:max-w-[90vw] md:max-h-[90vh] md:p-0"
    >
      <div class="relative w-full bg-surface overflow-y-auto flex flex-col md:m-0 md:w-auto md:max-w-none md:max-h-none md:bg-transparent md:rounded-none md:overflow-visible">
        <img 
          src={src} 
          alt={alt} 
          class="w-full h-auto object-cover max-h-[50vh] block md:max-h-[90vh] md:max-w-[90vw] md:object-contain"
        />
        {#if (title || description || subtitle)}
          <div class="p-4 text-on-surface md:text-surface flex flex-col gap-xs md:absolute md:bottom-0 md:left-0 md:right-0 md:p-6 md:bg-gradient-to-t from-black/60 to-transparent">
            {#if subtitle}<p class="text-sm">{subtitle}</p>{/if}
            {#if title}<p class="text-base font-semibold md:text-lg md:font-semibold">{title}</p>{/if}
            {#if description}<p class="text-xs rtf-content m-base m-0 md:text-sm">{@html description}</p>{/if}
          </div>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>