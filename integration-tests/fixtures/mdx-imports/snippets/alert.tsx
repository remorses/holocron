/** Alert snippet component for testing /snippets/ absolute imports */
export default function Alert({ message }: { message: string }) {
  return <div data-testid="alert" className="alert">{message}</div>
}
