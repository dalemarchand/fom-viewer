import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import ObjectClass from '../src/lib/TypeRenderer/ObjectClass.svelte';
import InteractionClass from '../src/lib/TypeRenderer/InteractionClass.svelte';

describe('Table Section Delineation (Option 1: DevTools Spine & Badges)', () => {
  let target;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    window.__showDetail = vi.fn();
    window.__showDataType = vi.fn();
    window.__getPreferredType = vi.fn();
  });

  afterEach(() => {
    target.remove();
    vi.restoreAllMocks();
  });

  describe('InteractionClass', () => {
    const mockInteraction = {
      name: 'WeaponFire',
      parameters: [
        { name: 'FireRate', dataType: 'HLAinteger32BE', sharing: 'Publish', semantics: 'Rounds/min' }
      ]
    };

    const mockParents = [
      {
        name: 'Action',
        parameters: [
          { name: 'Timestamp', dataType: 'HLAfloat64BE', sharing: 'Publish', semantics: 'Event time' },
          { name: 'SourceID', dataType: 'EntityID', sharing: 'Publish', semantics: 'Firing entity' }
        ]
      }
    ];

    it('renders thead and semantic multi-tbody structure for inheritance groups', () => {
      const component = mount(InteractionClass, {
        target,
        props: {
          item: mockInteraction,
          parents: mockParents
        }
      });

      const table = target.querySelector('.attr-table');
      expect(table).toBeTruthy();

      // Check thead exists with column headers
      const thead = table.querySelector('thead');
      expect(thead).toBeTruthy();
      expect(thead.querySelectorAll('th').length).toBeGreaterThan(0);

      // Check multiple tbodies with inheritance-group class
      const tbodies = table.querySelectorAll('tbody.inheritance-group');
      expect(tbodies.length).toBe(2);

      // Group 1: Current Class
      const currentGroup = tbodies[0];
      expect(currentGroup.classList.contains('current-level')).toBe(true);
      expect(currentGroup.classList.contains('subsequent-level')).toBe(false);

      const currentHeaderTh = currentGroup.querySelector('tr.level-header th');
      expect(currentHeaderTh).toBeTruthy();
      expect(currentHeaderTh.getAttribute('scope')).toBe('rowgroup');

      const currentBadge = currentGroup.querySelector('.badge-current');
      expect(currentBadge).toBeTruthy();
      expect(currentBadge.textContent.trim()).toBe('CURRENT CLASS');

      const currentName = currentGroup.querySelector('.level-class-name');
      expect(currentName.textContent.trim()).toBe('WeaponFire');

      const currentPill = currentGroup.querySelector('.level-count-pill');
      expect(currentPill.textContent.trim()).toBe('1 parameter');

      // Group 2: Inherited from Action
      const inheritedGroup = tbodies[1];
      expect(inheritedGroup.classList.contains('inherited-level')).toBe(true);
      expect(inheritedGroup.classList.contains('subsequent-level')).toBe(true);

      const inheritedBadge = inheritedGroup.querySelector('.badge-inherited');
      expect(inheritedBadge).toBeTruthy();
      expect(inheritedBadge.textContent.trim()).toBe('INHERITED FROM');

      const inheritedBtn = inheritedGroup.querySelector('button.level-class-name');
      expect(inheritedBtn).toBeTruthy();
      expect(inheritedBtn.textContent.trim()).toBe('Action');

      const inheritedPill = inheritedGroup.querySelector('.level-count-pill');
      expect(inheritedPill.textContent.trim()).toBe('2 parameters');

      // Verify clicking the inherited class link calls __showDetail
      inheritedBtn.click();
      expect(window.__showDetail).toHaveBeenCalledWith('Action', 'interactions', true);

      unmount(component);
    });
  });

  describe('ObjectClass', () => {
    const mockObject = {
      name: 'SurfaceVessel',
      attributes: [
        { name: 'DraftDepth', dataType: 'MeterFloat32', sharing: 'Publish', semantics: 'Draft depth' }
      ]
    };

    // Parents in FOM hierarchy are ordered from root ancestor to immediate parent: [root, immediateParent]
    const mockParents = [
      {
        name: 'BaseEntity',
        attributes: [
          { name: 'EntityID', dataType: 'EntityIdentifier', sharing: 'Publish', semantics: 'Identifier' }
        ]
      },
      {
        name: 'Platform',
        attributes: [
          { name: 'RelativeSpeed', dataType: 'SpeedKnots', sharing: 'Publish', semantics: 'Speed' }
        ]
      }
    ];

    it('renders thead and semantic multi-tbody structure for 3-tier inheritance', () => {
      const component = mount(ObjectClass, {
        target,
        props: {
          item: mockObject,
          parents: mockParents
        }
      });

      const table = target.querySelector('.attr-table');
      expect(table).toBeTruthy();

      const thead = table.querySelector('thead');
      expect(thead).toBeTruthy();

      const tbodies = table.querySelectorAll('tbody.inheritance-group');
      expect(tbodies.length).toBe(3);

      // Level 1: Current Class
      expect(tbodies[0].classList.contains('current-level')).toBe(true);
      expect(tbodies[0].querySelector('.badge-current').textContent.trim()).toBe('CURRENT CLASS');
      expect(tbodies[0].querySelector('.level-class-name').textContent.trim()).toBe('SurfaceVessel');
      expect(tbodies[0].querySelector('.level-count-pill').textContent.trim()).toBe('1 attribute');

      // Level 2: Immediate parent (Platform)
      expect(tbodies[1].classList.contains('inherited-level')).toBe(true);
      expect(tbodies[1].classList.contains('subsequent-level')).toBe(true);
      expect(tbodies[1].querySelector('.badge-inherited').textContent.trim()).toBe('INHERITED FROM');
      expect(tbodies[1].querySelector('button.level-class-name').textContent.trim()).toBe('Platform');
      expect(tbodies[1].querySelector('.level-count-pill').textContent.trim()).toBe('1 attribute');

      // Level 3: Root ancestor (BaseEntity)
      expect(tbodies[2].classList.contains('inherited-level')).toBe(true);
      expect(tbodies[2].classList.contains('subsequent-level')).toBe(true);
      expect(tbodies[2].querySelector('.badge-inherited').textContent.trim()).toBe('INHERITED FROM');
      const baseEntityBtn = tbodies[2].querySelector('button.level-class-name');
      expect(baseEntityBtn.textContent.trim()).toBe('BaseEntity');

      baseEntityBtn.click();
      expect(window.__showDetail).toHaveBeenCalledWith('BaseEntity', 'classes', true);

      unmount(component);
    });
  });
});
