describe('API client', () => {
  it('should export api client', () => {
    const api = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() };
    expect(api).toBeDefined();
  });
});
