<script>
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, issues = [] } = $props();
</script>

{#if item}
<div class="detail-section">
  <h3>Model Identification</h3>
  <table class="property-table">
    <tbody>
    {#if item.name}<tr><th>Name</th><td>{item.name}</td></tr>{/if}
    {#if item.type}<tr><th>Type</th><td>{item.type}</td></tr>{/if}
    {#if item.version}<tr><th>Version</th><td>{item.version}</td></tr>{/if}
    {#if item.modificationDate}<tr><th>Modification Date</th><td>{item.modificationDate}</td></tr>{/if}
    {#if item.securityClassification}<tr><th>Security Classification</th><td>{item.securityClassification}</td></tr>{/if}
    {#if item.purpose}<tr><th>Purpose</th><td>{item.purpose}</td></tr>{/if}
    {#if item.applicationDomain}<tr><th>Application Domain</th><td>{item.applicationDomain}</td></tr>{/if}
    {#if item.description}<tr><th>Description</th><td>{item.description}</td></tr>{/if}
    </tbody>
  </table>
</div>

{#if item.poc}
  <div class="detail-section">
    <h3>Point of Contact</h3>
    <table class="property-table">
      <tbody>
      {#if item.poc.pocType}<tr><th>Type</th><td>{item.poc.pocType}</td></tr>{/if}
      {#if item.poc.pocName}<tr><th>Name</th><td>{item.poc.pocName}</td></tr>{/if}
      {#if item.poc.pocOrg}<tr><th>Organization</th><td>{item.poc.pocOrg}</td></tr>{/if}
      {#if item.poc.pocTelephone}<tr><th>Telephone</th><td>{item.poc.pocTelephone}</td></tr>{/if}
      {#if item.poc.pocEmail}<tr><th>Email</th><td>{item.poc.pocEmail}</td></tr>{/if}
      </tbody>
    </table>
  </div>
{/if}
{/if}

<RelatedIssues issues={issues} />
