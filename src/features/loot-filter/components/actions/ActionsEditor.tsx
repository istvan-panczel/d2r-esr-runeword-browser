import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { resolveText } from '../../engine/text';
import type { LootFilter, RuleActions } from '../../engine/types';
import { effectiveActions, findStyle, previewLabelText } from '../../utils/effectiveActions';
import type { ShallowPatch } from '../../utils/patch';
import type { ActionField, ActionFieldGate } from '../../utils/ruleView';
import type { StyleKey, StyleTarget } from '../../utils/styleChoice';
import { CheckField, Field } from '../Field';
import { LabelPreview } from '../LabelPreview';
import { MinimapIconPreview } from '../MinimapIconPreview';
import { AdvancedBadge } from '../rules/AdvancedBadge';
import { ColorControl } from './ColorControl';
import { ColorTextField } from './ColorTextField';
import { IconField } from './IconField';
import { LabelSection } from './LabelSection';
import { NameColorField } from './NameColorField';
import { Section } from './Section';
import { SoundField } from './SoundField';
import { StyleSection } from './StyleSection';
import { styleValues } from './styleValues';

export interface ActionsEditorProps {
  /** The actions being edited (a rule's own actions, or a style's). */
  readonly actions: RuleActions;
  /** Shallow patch: a key with `undefined` removes it. The caller dispatches `patchRule` or `setStyle`. */
  readonly onChange: (patch: ShallowPatch<RuleActions>) => void;
  /**
   * A rule's Style dropdown pick (rules only): the caller sets `useStyle`, clears the rule's own values for the keys
   * the style sets and adds a picked preset (`utils/styleChoice.ts`), with an Undo toast.
   */
  readonly onChooseStyle?: (target: StyleTarget) => void;
  /** The whole filter, for the style list (`useStyle`), the quality colours and the label preview. */
  readonly filter: LootFilter;
  /** `rule`: offers `useStyle` and shows the style's values in the fields it sets; `style`: no `useStyle`. */
  readonly owner: 'rule' | 'style';
  /** Name of the style being edited (for the preview heading); unused for rules. */
  readonly styleName?: string;
  /**
   * The Basic / Advanced gate (`ruleFieldGate` for a rule, `actionFieldGate` for a style): Basic shows the common
   * actions, an Advanced one only when it holds a value (tagged), and a Name colour select. Undefined: every action.
   */
  readonly gate?: ActionFieldGate;
}

const DEFAULT_DROP_FORMAT = '{qualityColor}{name}';

/** The label preview draws the minimap icon at its size up to this (a 256 px icon would dwarf the label). */
const LABEL_PREVIEW_ICON_MAX = 64;

/**
 * Tile columns on wide pages (`/page` container steps, see PageShell): from @8xl every section is a bordered tile and
 * the tiles fill a grid, a tile row as high as its tallest tile. Standard pages never reach @8xl, so they keep the one
 * column of ruled sections. Tiles stay about 480 px or wider (narrower ones squeeze the Prefix / Suffix boxes):
 *
 * - `rule`: the actions card is under the conditions up to @10xl (editor about 1070 to 1870 px wide: two tiles),
 *   beside them from @10xl (about 700 px at 2400: one tile; 1100 px from 2880: two), see RuleEditor;
 * - `style`: the Styles tab editor next to its list (about 1150 px at @8xl up to 3000 px on a 3440 px Full page).
 */
const TILE_COLUMNS = {
  rule: '@8xl/page:grid-cols-2 @10xl/page:grid-cols-1 @11xl/page:grid-cols-2',
  style: '@8xl/page:grid-cols-2 @9xl/page:grid-cols-3 @10xl/page:grid-cols-4 @11xl/page:grid-cols-5',
} as const;

/**
 * Form for every action key of the guide (names, label colours, chat, notify, sound, icon, droplight,
 * useStyle, hide…), shared by the rule editor and the Styles tab. Each control sends a shallow patch;
 * `passthrough` is never touched. A rule's `comment` belongs to the rule editor; a style's is edited here.
 *
 * On a rule with a style, every field the style sets shows the style's value ("from style X"); editing it writes the
 * rule's own override ("changed from style X", Reset to style). One helper (`styleValues`) does it for every field.
 */
export function ActionsEditor({ actions, onChange, onChooseStyle, filter, owner, styleName, gate }: ActionsEditorProps) {
  const idPrefix = owner === 'style' ? `loot-filter-style-${(styleName ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}` : 'loot-filter-rule';
  const id = (key: string) => `${idPrefix}-${key}`;
  const shows = (field: ActionField) => (gate?.action(field) ?? 'shown') !== 'hidden';
  const advanced = (field: ActionField) => (gate?.action(field) === 'advanced' ? <AdvancedBadge owner={owner} /> : undefined);
  const basic = gate?.view === 'basic';

  const effective = owner === 'rule' ? effectiveActions(actions, filter) : actions;
  const style = owner === 'rule' ? findStyle(actions, filter) : undefined;
  const values = styleValues(actions, style, owner === 'rule' ? actions.useStyle : undefined, onChange);
  const { value, change } = values;
  /** The label extras of a field: its "advanced" tag and its style mark. */
  const badge = (key: StyleKey) => values.badge(key, advanced(key));
  const dropFormat = resolveText(filter.notifications?.dropFormat) ?? DEFAULT_DROP_FORMAT;
  const droplight = value('droplight');

  return (
    <div className={cn('flex flex-col gap-4 @8xl/page:grid', TILE_COLUMNS[owner])}>
      <div className="flex flex-col gap-1.5 @8xl/page:rounded-lg @8xl/page:border @8xl/page:p-4">
        <span className="text-sm font-medium">
          Label preview
          {owner === 'style' && styleName !== undefined ? ` · ${styleName}` : ''}
          {style !== undefined ? ' (with the style)' : ''}
        </span>
        <LabelPreview
          text={effective.hide === true ? '' : previewLabelText(effective)}
          background={effective.labelBackground}
          border={effective.labelBorder}
          className="min-h-16"
          trailing={
            effective.icon === undefined || effective.hide === true ? undefined : (
              <MinimapIconPreview icon={effective.icon} maxSize={LABEL_PREVIEW_ICON_MAX} />
            )
          }
        />
        <p className="text-xs text-muted-foreground">
          {effective.hide === true
            ? 'Hidden: the item shows no label.'
            : `{name} shows as "Item Name"; other placeholders as written. Without a colour code the game colours the name by quality.${effective.icon === undefined ? '' : ' Beside it the minimap icon at its size.'}`}
        </p>
      </div>

      {owner === 'rule' && shows('useStyle') && (
        <StyleSection
          idPrefix={idPrefix}
          actions={actions}
          filter={filter}
          onChoose={(target) => {
            if (onChooseStyle) onChooseStyle(target);
            else onChange({ useStyle: target.kind === 'none' ? undefined : target.kind === 'style' ? target.name : target.preset.name });
          }}
          badge={advanced('useStyle')}
        />
      )}

      <Section title="Visibility">
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckField
            id={id('hide')}
            label="Hide"
            hint="Hides the ground label and the item cannot be picked up; no later rule runs. A Show rule above protects the item."
            checked={value('hide') === true}
            badge={values.badge('hide')}
            onChange={(checked) => {
              change({ hide: values.flag('hide', checked) });
            }}
          />
          {shows('show') && (
            <CheckField
              id={id('show')}
              label="Show"
              hint="Keeps the item visible: no later rule can hide it; later rules still change its looks, chat lines and sounds. Not with Hide."
              checked={value('show') === true}
              badge={badge('show')}
              onChange={(checked) => {
                change({ show: values.flag('show', checked) });
              }}
            />
          )}
          {shows('hideIfOtherConditionsFail') && (
            <CheckField
              id={id('hide-if-other-fail')}
              label="Hide if other conditions fail"
              hint="When codes, types and location match but another condition fails, the item is hidden."
              checked={value('hideIfOtherConditionsFail') === true}
              badge={badge('hideIfOtherConditionsFail')}
              onChange={(checked) => {
                change({ hideIfOtherConditionsFail: values.flag('hideIfOtherConditionsFail', checked) });
              }}
            />
          )}
        </div>
        {shows('chatMessageWhenHidden') && (
          <ColorTextField
            id={id('chat-when-hidden')}
            label="Chat line when hidden"
            context="chat"
            defaultColor="0"
            value={value('chatMessageWhenHidden')}
            placeholder="ÿc5Hidden: {name}"
            hint="Printed when this rule hides the item."
            badge={badge('chatMessageWhenHidden')}
            onChange={(chatMessageWhenHidden) => {
              change({ chatMessageWhenHidden });
            }}
          />
        )}
      </Section>

      <Section title="Name">
        {/* Basic only: the common case of replaceName (the game's name in a colour) as a select. */}
        {basic && (
          <NameColorField
            id={id('name-color')}
            owner={owner}
            replaceName={value('replaceName')}
            fromStyle={values.fromStyle('replaceName')}
            badge={values.badge('replaceName')}
            onChange={(replaceName) => {
              change({ replaceName });
            }}
          />
        )}
        {shows('replaceName') && (
          <ColorTextField
            id={id('replace-name')}
            label="Replace name"
            context="names"
            value={value('replaceName')}
            placeholder="{name}"
            hint={<>A new name; {'{name}'} is the game&apos;s own. A later rule&apos;s replaceName overrides it.</>}
            badge={badge('replaceName')}
            onChange={(replaceName) => {
              change({ replaceName });
            }}
          />
        )}
        {(shows('namePrefix') || shows('nameSuffix')) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {shows('namePrefix') && (
              <ColorTextField
                id={id('name-prefix')}
                label="Prefix"
                context="names"
                value={value('namePrefix')}
                placeholder="ÿc1* "
                badge={badge('namePrefix')}
                onChange={(namePrefix) => {
                  change({ namePrefix });
                }}
              />
            )}
            {shows('nameSuffix') && (
              <ColorTextField
                id={id('name-suffix')}
                label="Suffix"
                context="names"
                value={value('nameSuffix')}
                placeholder=" ({sockets})"
                badge={badge('nameSuffix')}
                onChange={(nameSuffix) => {
                  change({ nameSuffix });
                }}
              />
            )}
          </div>
        )}
      </Section>

      <LabelSection
        idPrefix={idPrefix}
        background={{ value: value('labelBackground'), badge: badge('labelBackground'), fromStyle: values.fromStyle('labelBackground') }}
        border={{ value: value('labelBorder'), badge: badge('labelBorder'), fromStyle: values.fromStyle('labelBorder') }}
        onChange={change}
      />

      <Section title="Chat">
        <ColorTextField
          id={id('chat-message')}
          label="Chat line"
          context="chat"
          defaultColor="0"
          value={value('chatMessage')}
          placeholder="ÿc4Drop: {link}"
          hint="Printed once per item when it drops; replaces the drop line of notify. The launcher's chat notifications switch turns it off."
          badge={badge('chatMessage')}
          onChange={(chatMessage) => {
            change({ chatMessage });
          }}
        />
        {shows('notify') && (
          <CheckField
            id={id('notify')}
            label="Notify"
            hint={
              <>
                Prints the filter&apos;s drop line: <code className="break-all">{dropFormat}</code>
                {effective.chatMessage !== undefined ? ' (the chat line above replaces it).' : '.'}
              </>
            }
            checked={value('notify') === true}
            badge={badge('notify')}
            onChange={(checked) => {
              change({ notify: values.flag('notify', checked) });
            }}
          />
        )}
      </Section>

      <Section title="Sound">
        <SoundField
          idPrefix={idPrefix}
          sound={value('sound')}
          soundVolume={value('soundVolume')}
          filterVolume={filter.soundVolume}
          badge={badge('sound')}
          volumeBadge={badge('soundVolume')}
          fromStyle={values.fromStyle('sound')}
          onSoundChange={(sound) => {
            change({ sound });
          }}
          onVolumeChange={(soundVolume) => {
            change({ soundVolume });
          }}
        />
      </Section>

      <Section title="Minimap icon">
        <IconField
          idPrefix={idPrefix}
          icon={value('icon')}
          badge={badge('icon')}
          fromStyle={values.fromStyle('icon')}
          onChange={(icon) => {
            change({ icon });
          }}
        />
      </Section>

      {shows('droplight') && (
        <Section title="Droplight">
          <CheckField
            id={id('droplight')}
            label="Droplight"
            hint={
              values.fromStyle('droplight')
                ? 'A beam of light with a sparkle on the item. HD graphics only. The style gives it: change its tint here, or pick another style to drop it.'
                : 'A beam of light with a sparkle on the item. HD graphics only.'
            }
            checked={droplight !== undefined}
            disabled={values.fromStyle('droplight')}
            badge={badge('droplight')}
            onChange={(checked) => {
              change({ droplight: checked ? {} : undefined });
            }}
          />
          {droplight !== undefined && (
            <Field id={id('droplight-color')} label="Tint">
              <ColorControl
                id={id('droplight-color')}
                label="droplight tint"
                value={droplight.color}
                noneLabel="the game's white beam"
                onChange={(color) => {
                  change({ droplight: color === undefined ? {} : { color: [color[0], color[1], color[2]] } });
                }}
              />
            </Field>
          )}
        </Section>
      )}

      {owner === 'style' && (
        <Section title="Notes">
          <Field id={id('comment')} label="Comment" hint="A note for yourself; the plugin ignores it.">
            <Input
              id={id('comment')}
              value={actions.comment ?? ''}
              autoComplete="off"
              onChange={(event) => {
                onChange({ comment: event.target.value === '' ? undefined : event.target.value });
              }}
            />
          </Field>
        </Section>
      )}
    </div>
  );
}
