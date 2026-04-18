/** Reusable greeting snippet component */
export const Greeting = ({ name }: { name: string }) => {
  return <div data-testid="greeting">Hello, {name}!</div>
}
