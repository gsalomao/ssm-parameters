/*
 * Copyright (c) 2021 Gustavo Salomão
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { SSMParameters } from './ssm-parameters';

const mockSSM = {
  promise: jest.fn().mockReturnValue(Promise.resolve()),
  getParameters: jest.fn((_) => ({
    promise: () => mockSSM.promise(),
  })),
};

jest.mock('aws-sdk', () => ({
  SSM: jest.fn(() => ({
    getParameters: jest.fn((params) => mockSSM.getParameters(params)),
  })),
}));

describe('SSMParameters', () => {
  beforeEach(() => {
    mockSSM.getParameters.mockClear();
    mockSSM.promise.mockResolvedValue({
      Parameters: [
        {
          Name: '/LogLevel',
          Type: 'String',
          Value: 'INFO',
        },
      ],
    });
  });

  it('should not call AWS during instantiation', () => {
    new SSMParameters({ LogLevel: '/LogLevel' });
    expect(mockSSM.getParameters).not.toHaveBeenCalled();
  });

  describe('load', () => {
    it('should load single parameter from AWS', async () => {
      const params = new SSMParameters(
        { LogLevel: '/LogLevel' },
        { withDecryption: true },
      );

      await params.load();

      expect(mockSSM.getParameters).toHaveBeenCalledWith({
        Names: ['/LogLevel'],
        WithDecryption: true,
      });
    });

    it('should load multiple parameters from AWS', async () => {
      const params = new SSMParameters(
        { LogLevel: '/LogLevel', AppId: '/AppId', ClientId: '/ClientId' },
        { withDecryption: false },
      );

      await params.load();

      expect(mockSSM.getParameters).toHaveBeenCalledWith({
        Names: ['/LogLevel', '/AppId', '/ClientId'],
        WithDecryption: false,
      });
    });

    it('should not load parameters when cache has not expired', async () => {
      const params = new SSMParameters(
        { LogLevel: '/LogLevel' },
        { maxAge: 1 },
      );

      await params.load();
      mockSSM.getParameters.mockClear();

      await params.load();
      expect(mockSSM.getParameters).not.toHaveBeenCalled();
    });

    it('should load parameters when cache has expired', async () => {
      const params = new SSMParameters(
        { LogLevel: '/LogLevel' },
        { maxAge: 1 },
      );

      await params.load();
      mockSSM.getParameters.mockClear();

      await new Promise((resolve: any) =>
        setTimeout(async () => {
          await params.load();
          resolve();
        }, 2000),
      );

      expect(mockSSM.getParameters).toHaveBeenCalled();
    });

    it("should always load parameters when 'maxAge' is '0'", async () => {
      const params = new SSMParameters(
        { LogLevel: '/LogLevel' },
        { maxAge: 0 },
      );

      await params.load();
      await params.load();
      await params.load();
      expect(mockSSM.getParameters).toHaveBeenCalledTimes(3);
    });

    it("should load parameters when 'ignoreCache' is 'true'", async () => {
      const params = new SSMParameters(
        { LogLevel: '/LogLevel' },
        { maxAge: 10 },
      );

      await params.load({ ignoreCache: true });
      await params.load({ ignoreCache: true });
      await params.load({ ignoreCache: true });

      expect(mockSSM.getParameters).toHaveBeenCalledTimes(3);
    });

    it('should request multiple times when loading more than 10 parameters', async () => {
      mockSSM.promise
        .mockResolvedValueOnce({
          Parameters: [
            {
              Name: '/Parameter1',
              Type: 'String',
              Value: 'Parameter1',
            },
            {
              Name: '/Parameter2',
              Type: 'String',
              Value: 'Parameter2',
            },
            {
              Name: '/Parameter3',
              Type: 'String',
              Value: 'Parameter3',
            },
            {
              Name: '/Parameter4',
              Type: 'String',
              Value: 'Parameter4',
            },
            {
              Name: '/Parameter5',
              Type: 'String',
              Value: 'Parameter5',
            },
            {
              Name: '/Parameter6',
              Type: 'String',
              Value: 'Parameter6',
            },
            {
              Name: '/Parameter7',
              Type: 'String',
              Value: 'Parameter7',
            },
            {
              Name: '/Parameter8',
              Type: 'String',
              Value: 'Parameter8',
            },
            {
              Name: '/Parameter9',
              Type: 'String',
              Value: 'Parameter9',
            },
            {
              Name: '/Parameter10',
              Type: 'String',
              Value: 'Parameter10',
            },
          ],
        })
        .mockResolvedValueOnce({
          Parameters: [
            {
              Name: '/Parameter11',
              Type: 'String',
              Value: 'Parameter11',
            },
            {
              Name: '/Parameter12',
              Type: 'String',
              Value: 'Parameter12',
            },
          ],
        });

      const params = new SSMParameters({
        Parameter1: '/Parameter1',
        Parameter2: '/Parameter2',
        Parameter3: '/Parameter3',
        Parameter4: '/Parameter4',
        Parameter5: '/Parameter5',
        Parameter6: '/Parameter6',
        Parameter7: '/Parameter7',
        Parameter8: '/Parameter8',
        Parameter9: '/Parameter9',
        Parameter10: '/Parameter10',
        Parameter11: '/Parameter11',
        Parameter12: '/Parameter12',
      });

      await params.load();

      expect(mockSSM.getParameters).toHaveBeenNthCalledWith(1, {
        Names: [
          '/Parameter1',
          '/Parameter2',
          '/Parameter3',
          '/Parameter4',
          '/Parameter5',
          '/Parameter6',
          '/Parameter7',
          '/Parameter8',
          '/Parameter9',
          '/Parameter10',
        ],
        WithDecryption: true,
      });

      expect(mockSSM.getParameters).toHaveBeenNthCalledWith(2, {
        Names: ['/Parameter11', '/Parameter12'],
        WithDecryption: true,
      });
    });
  });

  describe('get', () => {
    it("should load parameters when 'get' is called before 'load'", async () => {
      const params = new SSMParameters({ LogLevel: '/LogLevel' });

      await params.get('LogLevel');

      expect(mockSSM.getParameters).toHaveBeenCalledWith({
        Names: ['/LogLevel'],
        WithDecryption: true,
      });
    });

    it("should not load parameters when 'get' is called after 'load'", async () => {
      const params = new SSMParameters({ LogLevel: '/LogLevel' });

      await params.load();
      mockSSM.getParameters.mockClear();

      await params.get('LogLevel');
      expect(mockSSM.getParameters).not.toHaveBeenCalled();
    });

    it('should get the loaded parameters', async () => {
      mockSSM.promise.mockResolvedValueOnce({
        Parameters: [
          {
            Name: '/Environment',
            Type: 'String',
            Value: 'DEV',
          },
          {
            Name: '/Key',
            Type: 'SecretString',
            Value: '12345',
          },
        ],
      });

      const params = new SSMParameters({
        Environment: '/Environment',
        Key: '/Key',
      });

      await params.load();

      await expect(params.get('Environment')).resolves.toBe('DEV');
      await expect(params.get('Key')).resolves.toBe('12345');
    });

    it("should get 'undefined' when parameter does not exist", async () => {
      const params = new SSMParameters({ AppId: '/AppId' });
      await params.load();

      const appId = await params.get('AppId');
      expect(appId).not.toBeDefined();
    });

    it("should load parameters when 'ignoreCache' is 'true'", async () => {
      const params = new SSMParameters({ LogLevel: '/LogLevel' });

      await params.get('LogLevel', { ignoreCache: true });
      await params.get('LogLevel', { ignoreCache: true });
      await params.get('LogLevel', { ignoreCache: true });

      expect(mockSSM.getParameters).toHaveBeenCalledTimes(3);
    });
  });

  describe('getAll', () => {
    it("should load parameters when 'getAll' is called before 'load'", async () => {
      const params = new SSMParameters({ LogLevel: '/LogLevel' });

      await params.getAll();

      expect(mockSSM.getParameters).toHaveBeenCalledWith({
        Names: ['/LogLevel'],
        WithDecryption: true,
      });
    });

    it("should not load parameters when 'getAll' is called after 'load'", async () => {
      const params = new SSMParameters({ LogLevel: '/LogLevel' });

      await params.load();
      mockSSM.getParameters.mockClear();

      await params.getAll();
      expect(mockSSM.getParameters).not.toHaveBeenCalled();
    });

    it('should get all loaded parameters', async () => {
      mockSSM.promise.mockResolvedValueOnce({
        Parameters: [
          {
            Name: '/Environment',
            Type: 'String',
            Value: 'PROD',
          },
          {
            Name: '/ApiKey',
            Type: 'SecretString',
            Value: '12345',
          },
        ],
      });

      const params = new SSMParameters({
        Environment: '/Environment',
        ApiKey: '/ApiKey',
      });

      await params.load();
      const parameters = await params.getAll();

      expect(parameters.Environment).toBe('PROD');
      expect(parameters.ApiKey).toBe('12345');
    });

    it("should get 'undefined' when parameter does not exist", async () => {
      const params = new SSMParameters({ AppId: '/AppId' });
      await params.load();

      const parameters = await params.getAll();
      expect(parameters.AppId).not.toBeDefined();
    });

    it("should load parameters when 'ignoreCache' is 'true'", async () => {
      const params = new SSMParameters({ LogLevel: '/LogLevel' });

      await params.getAll({ ignoreCache: true });
      await params.getAll({ ignoreCache: true });
      await params.getAll({ ignoreCache: true });

      expect(mockSSM.getParameters).toHaveBeenCalledTimes(3);
    });
  });
});
