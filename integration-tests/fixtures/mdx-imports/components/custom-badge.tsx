/** Custom badge component imported from MDX */
export const CustomBadge = ({ label }: { label: string }) => {
  return <span data-testid="custom-badge" className="custom-badge">{label}</span>
}

export default CustomBadge
