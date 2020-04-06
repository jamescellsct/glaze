/* Prefer performance over elegance, as this code is critical for the runtime */

import hash from '@emotion/hash';
import { useContext, useEffect, useRef } from 'react';
import { useStyles } from 'react-treat';
import { Style } from 'treat';

import { isDev } from './env';
import { StyleInjectorContext } from './StyleInjectorContext';
import { useTheme } from './ThemeContext';
import styleRefs from './useStyling.treat';

function kebabCaseReplacer(match: string): string {
  return `-${match.toLowerCase()}`;
}

function getClassName(identName: string): string {
  return isDev ? `DYNAMIC_${identName}` : `d_${hash(identName)}`;
}

export type ThemedStyle = Style & {
  // TODO: Autocomplete for themed values
  /*
    [key in keyof CSSProperties]: key extends keyof ThemeOrAny['resolvers']
      ? ThemeOrAny['scales'][ThemeOrAny['resolvers'][key]] // CSSProperties[ThemeOrAny['resolvers'][key]]
      : CSSProperties[key];
    */
  // TODO: Autocomplete for aliases and shorthands
};

export function useStyling(): (themedStyle: ThemedStyle) => string {
  const staticClassNames = useStyles(styleRefs);
  const theme = useTheme();
  const { ruleManager } = useContext(StyleInjectorContext);
  const ownRuleUsageCountsByClassName = useRef<{ [key: string]: number }>({})
    .current;

  // Remove dynamic styles which are not used anymore when unmounting
  useEffect(
    () => (): void => {
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const className in ownRuleUsageCountsByClassName) {
        const usageCount = ownRuleUsageCountsByClassName[className];
        ruleManager.decreaseUsage(className, usageCount);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return function sx(themedStyle: ThemedStyle): string {
    let className = '';

    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const alias in themedStyle) {
      // TODO: Remove type assertion if possible
      const value = themedStyle[alias as keyof ThemedStyle];
      const shorthand = theme.aliases[alias] || alias;

      // eslint-disable-next-line no-loop-func
      (theme.shorthands[shorthand] || [shorthand]).forEach((key) => {
        // TODO: Support selectors and media queries
        if (typeof value !== 'object') {
          const identName = `${key}-${value}`;
          let appendedClassName = staticClassNames[identName];

          // Attach a class dynamically if needed
          if (!appendedClassName) {
            // TODO: Use same hashing algorithm during static CSS generation
            appendedClassName = getClassName(identName);
            ruleManager.increaseUsage(
              appendedClassName,
              () =>
                `.${appendedClassName}{${
                  // TODO: Abstract this logic away to a utility function
                  // Convert CSS property to kebab-case and normalize numeric value
                  `${key.replace(/[A-Z]/g, kebabCaseReplacer)}:${
                    typeof value !== 'number' ? value : `${value}px`
                  }`
                }}`,
            );

            ownRuleUsageCountsByClassName[appendedClassName] =
              // eslint-disable-next-line no-bitwise
              (ownRuleUsageCountsByClassName[appendedClassName] | 0) + 1;
          }

          className += ` ${appendedClassName}`;
        }
      });
    }

    // Remove prepended whitespace
    return className.slice(1);
  };
}
