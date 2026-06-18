<script lang="ts">
	import { getEmblaContext } from "./context.js";

	const {navigation = undefined} = $props()

	const emblaCtx = getEmblaContext("<Carousel.Navigation/>");

	let totalSlides = $state(0);
	let currentIndex = $state(0);

	// Function to update state
	function updateState() {
		if (emblaCtx.api) {
			totalSlides = emblaCtx.api.scrollSnapList().length;
			currentIndex = emblaCtx.api.selectedScrollSnap();
		}
	}

	// Set up event listeners
	function setupListeners() {
		if (!emblaCtx.api) return;

		const api = emblaCtx.api;
		api.on("select", updateState);
		api.on("slidesChanged", updateState);
		api.on("init", updateState);

		return () => {
			api.off("select", updateState);
			api.off("slidesChanged", updateState);
			api.off("init", updateState);
		};
	}

	// Initial setup
	$effect(() => {
		if (emblaCtx.api) {
			setupListeners();
			updateState(); // Initial state update
		}
	})

	function handleDotClick(index: number) {
		emblaCtx.api?.scrollTo(index);
	}
</script>

{#if totalSlides > 0}
	<div class="flex items-center justify-center space-x-2">
		{#if !navigation}
			<button
				onclick={emblaCtx.scrollPrev}
				aria-label="Previous slide"
				class="px-4 relative rounded-full {emblaCtx.canScrollPrev ? 'text-on-surface overlay before:bg-on-surface/5 active:before:bg-on-surface/10' : 'text-outline-variant cursor-default'}"
			>
				<i class="ri-arrow-left-s-line"></i>
			</button>
			{#each Array(totalSlides) as _, i}
				<button
					onclick={() => handleDotClick(i)}
					class="h-2 w-2 rounded-full bg-gray-400 transition-all duration-300 ease-in-out {currentIndex === i ? 'w-[32px] bg-on-surface' : 'bg-outline-variant'}"
					aria-label="Go to slide {i + 1}"
				></button>
			{/each}
			<button
				onclick={emblaCtx.scrollNext}
				aria-label="Next slide"
				class="px-4 relative rounded-full {emblaCtx.canScrollNext ? 'text-on-surface overlay before:bg-on-surface/5 active:before:bg-on-surface/10' : 'text-outline-variant cursor-default'}"
			>
				<i class="ri-arrow-right-s-line"></i>
			</button>
		{:else}
			{@render navigation({scrollPrev: emblaCtx.scrollPrev, handleClick: handleDotClick, scrollNext: emblaCtx.scrollNext, currentIndex})}
		{/if}
	</div>
{/if}