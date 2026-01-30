export function JsonPreview({ data }: { data: any }) {
  return (
    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontSize: 12 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
