<script>
let { tabs = [], container = '' } = $props();
</script>

{#each tabs as tab, i}
  <div class="subtab" class:active={i === 0} data-subtab={tab.id} data-testid="subtab-{container}-{tab.id}">{tab.label}</div>
{/each}
