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

import { SSM } from 'aws-sdk';

/**
 * Options for the *SSMParameters*.
 */
export interface SSMParametersOptions {
  /** Return decrypted values for secure string parameters */
  withDecryption?: boolean;

  /** Maximum number of seconds the parameters will be considered fresh */
  maxAge?: number;

  /** https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SSM.html */
  ssmConfiguration?: SSM.ClientConfiguration;
}

/**
 * Options when loading or getting the parameters.
 */
export interface SSMParametersLoadOptions {
  /** Ignore any existing cache and load the parameters */
  ignoreCache: boolean;
}

/**
 * Class responsible to load and cache parameters from the AWS SSM Parameters
 * Store.
 */
export class SSMParameters<Parameters extends Record<string, string>> {
  private readonly DEFAULT_WITH_DECRYPTION = true;
  private readonly DEFAULT_MAX_AGE_IN_SECONDS = 3600;
  private readonly MAX_PARAMETERS_PER_REQUEST = 10;

  private readonly withDecryption: boolean;
  private readonly maxAge: number;
  private readonly ssmClient: SSM;
  private parametersName: Parameters;
  private parametersValue: Record<string, string | undefined> = {};
  private parameterLoaded: Record<string, boolean> = {};
  private lastLoadTime: Date | undefined;

  /**
   * Create an instance of the *SSMParameters*.
   *
   * @example
   * new SSMParameters({ LogLevel: '/LogLevel' });
   * new SSMParameters({ LogLevel: '/LogLevel' }, { maxAge: 60 });
   *
   * @param parameters Map with parameter's keys and parameter's names on AWS.
   * @param options *SSMParametersOptions*
   */
  constructor(parameters: Parameters, options?: SSMParametersOptions) {
    this.parametersName = parameters;
    this.maxAge = options?.maxAge ?? this.DEFAULT_MAX_AGE_IN_SECONDS;
    this.ssmClient = new SSM(options?.ssmConfiguration);
    this.withDecryption =
      options?.withDecryption ?? this.DEFAULT_WITH_DECRYPTION;

    Object.values(parameters).forEach((name: string) => {
      this.parametersValue[name] = undefined;
      this.parameterLoaded[name] = false;
    });
  }

  /**
   * Load parameters from AWS SSM Parameter Store.
   *
   * @note
   *  - If the parameters have not been loaded yet, they will be loaded.
   *  - If the parameters have been loaded and cache didn't expired yet,
   *    it uses the cache.
   *  - If the parameters have been loaded but the cache has expired, it loads
   *    the parameters again.
   *
   * @param options *SSMParametersLoadOptions*
   * @returns Promise to when parameters have been loaded or cache is used.
   */
  async load(
    options: SSMParametersLoadOptions = { ignoreCache: false },
  ): Promise<void> {
    const cacheAge = this.lastLoadTime
      ? Math.round((new Date().getTime() - this.lastLoadTime.getTime()) / 1000)
      : this.maxAge + 1;

    if (!options.ignoreCache && this.maxAge && cacheAge <= this.maxAge) {
      return Promise.resolve();
    }

    Object.entries(this.parameterLoaded).forEach((param) => (param[1] = false));

    const parametersToLoad = this.getParametersToLoad();
    return this.loadParameters(parametersToLoad);
  }

  /**
   * Get parameter.
   *
   * @note
   *  - If the parameters have not been loaded yet, they will be loaded.
   *  - If the parameters have been loaded and cache didn't expired yet,
   *    it uses the cache.
   *  - If the parameters have been loaded but the cache has expired, it loads
   *    the parameters again.
   *
   * @param key Key of the parameter.
   * @param options *SSMParametersLoadOptions*
   * @returns Promise to parameter's value or undefined if it does not exist.
   */
  async get(
    key: keyof Parameters,
    options: SSMParametersLoadOptions = { ignoreCache: false },
  ): Promise<string | undefined> {
    return this.load(options).then(
      () => this.parametersValue[this.parametersName[key]],
    );
  }

  /**
   * Get parameters.
   *
   * @note
   *  - If the parameters have not been loaded yet, they will be loaded.
   *  - If the parameters have been loaded and cache didn't expired yet,
   *    it uses the cache.
   *  - If the parameters have been loaded but the cache has expired, it loads
   *    the parameters again.
   *
   * @param options *SSMParametersLoadOptions*
   * @returns Promise to all parameters.
   */
  async getAll(
    options: SSMParametersLoadOptions = { ignoreCache: false },
  ): Promise<Record<keyof Parameters, string | undefined>> {
    return this.load(options).then(() => {
      const response = {} as Record<keyof Parameters, string | undefined>;

      Object.entries(this.parametersName).forEach(([name, value]) => {
        response[name as keyof Parameters] = this.parametersValue[value];
      });

      return response;
    });
  }

  /**
   * Get parameters to load.
   *
   * @note The array returned by this function contains a maximum number of
   *       parameters defined by `MAX_PARAMETERS_PER_REQUEST`.
   *
   * @returns Array of parameters to load.
   */
  private getParametersToLoad(): string[] {
    return Object.entries(this.parameterLoaded)
      .filter((param) => !param[1])
      .map((param) => param[0])
      .slice(0, this.MAX_PARAMETERS_PER_REQUEST);
  }

  /**
   * Load parameters from AWS SSM.
   *
   * @param parameters Parameters to load from AWS SSM.
   * @returns Promise to when parameters have been loaded.
   */
  private async loadParameters(parameters: string[]): Promise<void> {
    const ssmRequest: SSM.Types.GetParametersRequest = {
      Names: parameters,
      WithDecryption: this.withDecryption,
    };

    return this.ssmClient
      .getParameters(ssmRequest)
      .promise()
      .then((response) => {
        response.Parameters!.forEach((param) => {
          this.parametersValue[param.Name!] = param.Value;
        });

        parameters.forEach((param) => {
          this.parameterLoaded[param] = true;
        });

        parameters = this.getParametersToLoad();

        if (parameters.length) {
          return this.loadParameters(parameters);
        }

        this.lastLoadTime = new Date();
        return Promise.resolve();
      });
  }
}
