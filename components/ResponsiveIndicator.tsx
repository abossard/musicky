import { useMediaQuery } from '@mantine/hooks';
import { Badge, Group, Text } from '@mantine/core';

/**
 * Component to show current screen size for testing responsive behavior
 */
export function ResponsiveIndicator({ 
  isMenuOpen 
}: { 
  isMenuOpen?: boolean 
}) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const getScreenSize = () => {
    if (isMobile) return { label: 'Mobile', color: 'red' };
    if (isTablet) return { label: 'Tablet', color: 'orange' };
    return { label: 'Desktop', color: 'green' };
  };

  const { label, color } = getScreenSize();

  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">Current viewport:</Text>
      <Badge variant="light" color={color} size="sm">
        {label}
      </Badge>
      <Text size="xs" c="dimmed">
        (Navbar {isMobile ? (isMenuOpen ? 'open' : 'collapsed') : 'visible'})
      </Text>
      {isMobile && isMenuOpen !== undefined && (
        <Badge variant="outline" color={isMenuOpen ? 'blue' : 'gray'} size="sm">
          Menu {isMenuOpen ? 'Open' : 'Closed'}
        </Badge>
      )}
    </Group>
  );
}
