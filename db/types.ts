export interface QueryResult<Row = unknown> {
  rows: Row[];
}

export interface DatabaseQueryable {
  query<Row = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}
