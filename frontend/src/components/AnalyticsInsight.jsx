import React from 'react';

function AnalyticsInsight({
  as: Component = 'button',
  insight,
  onOpen,
  children,
  className = '',
  disabled = false,
  ...props
}) {
  const interactive = Boolean(insight && onOpen && !disabled);
  const componentProps = {
    className: `${className} ${interactive ? 'cursor-pointer analytics-clickable' : ''}`.trim(),
    ...props,
  };

  if (Component === 'button') {
    componentProps.type = props.type || 'button';
    componentProps.disabled = disabled;
  }

  if (interactive) {
    componentProps.onClick = (event) => {
      props.onClick?.(event);
      if (!event.defaultPrevented) {
        event.stopPropagation();
        onOpen(insight);
      }
    };
    componentProps.title = props.title || 'Click for explanation';
  }

  return <Component {...componentProps}>{children}</Component>;
}

export default AnalyticsInsight;
