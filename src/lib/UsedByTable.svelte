<script>
  let { usages = [] } = $props();

  const typeLabels = {
    simple: 'Simple', array: 'Array', fixed: 'Fixed',
    variant: 'Variant', enum: 'Enum',
    object: 'Object Class', interaction: 'Interaction Class'
  };
</script>

{#if usages.length > 0}
  <h4 style="margin:12px 0 8px">Used By <span class="badge">{usages.length}</span></h4>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><th>Type</th><th>Location</th></tr>
    {#each usages as u}
      <tr>
        <td>
          {#if u.type === 'object' || u.type === 'interaction'}
            <button type="button" class="clickable-item" onclick={() => window.__showDetail(u.name, u.type, true)}>{u.name}</button>
          {:else}
            <button type="button" class="clickable-item" onclick={() => window.__showDataType(u.name, u.type)}>{u.name}</button>
          {/if}
        </td>
        <td>{typeLabels[u.type] || u.type}</td>
        <td>{u.location}</td>
      </tr>
    {/each}
    </tbody>
  </table>
{/if}
