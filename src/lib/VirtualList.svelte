<script>
  let {
    height = 300,
    width = '100%',
    itemCount = 0,
    itemSize = 30,
    overscanCount = 5,
    children
  } = $props();

  let containerEl = $state(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  $effect(() => {
    if (typeof height === 'number') {
      viewportHeight = height;
    }
  });

  let totalHeight = $derived(itemCount * itemSize);

  let startIndex = $derived(
    Math.max(0, Math.floor(scrollTop / itemSize) - overscanCount)
  );
  let endIndex = $derived(
    Math.min(itemCount - 1, Math.ceil((scrollTop + viewportHeight) / itemSize) + overscanCount - 1)
  );

  let visibleItems = $derived.by(() => {
    const items = [];
    if (itemCount === 0 || itemSize <= 0) return items;
    for (let idx = startIndex; idx <= endIndex; idx++) {
      items.push({
        index: idx,
        style: `position:absolute;top:${idx * itemSize}px;height:${itemSize}px;left:0;right:0`
      });
    }
    return items;
  });

  function handleScroll(e) {
    const el = e.currentTarget;
    scrollTop = el.scrollTop;
    viewportHeight = el.clientHeight;
  }
</script>

<div
  class="virtual-list-outer"
  style="height:{typeof height === 'number' ? height + 'px' : height};width:{typeof width === 'number' ? width + 'px' : width}"
  onscroll={handleScroll}
  bind:this={containerEl}
>
  <div class="virtual-list-inner" style="height:{totalHeight}px">
    {#if children}
      {@render children({ items: visibleItems })}
    {/if}
  </div>
</div>

<style>
  .virtual-list-outer {
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    -webkit-overflow-scrolling: touch;
  }
  .virtual-list-inner {
    position: relative;
    width: 100%;
  }
</style>
