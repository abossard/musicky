import { usePageContext } from "vike-react/usePageContext";
import { NavLink } from "@mantine/core";

export function Link({ 
  href, 
  label, 
  onClick 
}: { 
  href: string; 
  label: string; 
  onClick?: () => void;
}) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const isActive = href === "/" ? urlPathname === href : urlPathname.startsWith(href);
  
  const handleClick = () => {
    // Call the onClick handler if provided (for closing mobile menu)
    if (onClick) {
      onClick();
    }
  };
  
  return (
    <NavLink 
      href={href} 
      label={label} 
      active={isActive} 
      onClick={handleClick}
    />
  );
}
