<script lang="ts">
	import { getEmblaContext } from "./context.js";

	const emblaCtx = getEmblaContext("<Carousel.CenterNavigation/>");

	let totalSlides = $state(0);
	let currentIndex = $state(0);
	let slideWidth = $state(0);

	// Function to update state
	function updateState() {
		if (emblaCtx.api) {
			const api = emblaCtx.api;
			totalSlides = api.scrollSnapList().length;
			currentIndex = api.selectedScrollSnap();
			
			// Get the first slide's width
			const slide = api.slideNodes()[0];
			if (slide) {
				slideWidth = slide.getBoundingClientRect().width;
			}
		}
	}

	// Set up event listeners
	function setupListeners() {
		if (!emblaCtx.api) return;

		const api = emblaCtx.api;
		api.on("select", updateState);
		api.on("slidesChanged", updateState);
		api.on("init", updateState);
		api.on("resize", updateState);

		return () => {
			api.off("select", updateState);
			api.off("slidesChanged", updateState);
			api.off("init", updateState);
			api.off("resize", updateState);
		};
	}

	// Initial setup
	$effect(() => {
		if (emblaCtx.api) {
			setupListeners();
			updateState(); // Initial state update

			// Also update on resize
			const resizeObserver = new ResizeObserver(updateState);
			const container = emblaCtx.api.containerNode();
			if (container) {
				resizeObserver.observe(container);
			}

			return () => {
				resizeObserver.disconnect();
			};
		}
	});
</script>

{#if totalSlides > 0}
	{#if slideWidth > 0}
	<div 
		class="absolute inset-0 pointer-events-none hidden md:block"
		style={`width: ${slideWidth}px; left: 50%; transform: translateX(-50%);`}
	>
		<div class="relative w-full h-full">
			<button
				onclick={emblaCtx.scrollPrev}
				aria-label="Previous slide"
				class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 rounded-full p-2 outline outline-outline-variant/[24%] bg-outline/[38%] aspect-square flex items-center justify-center text-surface overlay before:bg-surface/10 active:before:bg-surface/20 pointer-events-auto transition-opacity {!emblaCtx.canScrollPrev ? 'opacity-0' : 'opacity-100 overlay before:bg-on-surface/5 active:before:bg-on-surface/10'}"
			>
				<i class="ri-arrow-left-s-line text-2xl"></i>
			</button>
			<button
				onclick={emblaCtx.scrollNext}
				aria-label="Next slide"
				class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 rounded-full p-2 outline outline-outline-variant/[24%] bg-outline/[38%] aspect-square flex items-center justify-center text-surface overlay before:bg-surface/10 active:before:bg-surface/20 pointer-events-auto transition-opacity {!emblaCtx.canScrollNext ? 'opacity-0' : 'opacity-100 overlay before:bg-on-surface/5 active:before:bg-on-surface/10'}"
			>
				<i class="ri-arrow-right-s-line text-2xl"></i>
			</button>
		</div>
	</div>
{/if}
{/if}
