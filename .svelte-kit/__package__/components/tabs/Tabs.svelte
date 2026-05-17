<script lang="ts">
  import TabItem from "./TabItem.svelte";

  let {activeTabIndex = $bindable(0), tabItem, data} = $props()


</script>

<div class="w-full flex flex-row items-center">
  {#each data as item, index}
    <TabItem onclick={() => activeTabIndex = index} active={index === activeTabIndex}>{@render tabItem(item)}</TabItem>
  {/each}
</div>