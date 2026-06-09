<script>
  let { rows = [], children } = $props();
</script>

<table class="property-table">
  {#each rows as { label, value }}
    <tr>
      <th>{label}</th>
      <td>{@html value}</td>
    </tr>
  {/each}
  {#if children}
    {@render children()}
  {/if}
</table>
