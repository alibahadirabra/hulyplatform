//
// Copyright © 2020 Anticrm Platform Contributors.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const Dotenv = require('dotenv-webpack')
const path = require('path')
const autoprefixer = require('autoprefixer')
const CompressionPlugin = require('compression-webpack-plugin')
const DefinePlugin = require('webpack').DefinePlugin

const mode = process.env.NODE_ENV || 'development'
const prod = mode === 'production'
const devServer = (process.env.CLIENT_TYPE ?? '') === 'dev-server'

module.exports = {
  entry: {
    bundle: [
      '@anticrm/theme/styles/global.scss',
      './src/main.ts'
    ]
  },
  resolve: {
    symlinks: true,
    alias: {
      svelte: path.resolve('./node_modules', 'svelte')
    },
    extensions: ['.mjs', '.js', '.svelte', '.ts'],
    mainFields: ['svelte', 'browser', 'module', 'main']
  },
  output: {
    path: __dirname + '/dist',
    filename: '[name].js',
    chunkFilename: '[name].[id].js',
    publicPath: '/'
  },
  optimization: {
    minimize: prod,
    usedExports: prod,
    splitChunks: {
      chunks: 'all',
      maxAsyncRequests: 5,
      maxInitialRequests: 3,
      cacheGroups: {
        vendors: {
          name: 'vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: 20
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: { 
            emitCss: true,
            preprocess: require('svelte-preprocess')({ postcss: true })
          }
          // options: {
          //   dev: !prod,
          //   emitCss: true,
          //   hotReload: !prod,
          //   preprocess: require('svelte-preprocess')({
          //     babel: {
          //       presets: [
          //         [
          //           '@babel/preset-env',
          //           {
          //             loose: true,
          //             modules: false,
          //             targets: {
          //               esmodules: true
          //             }
          //           }
          //         ],
          //         '@babel/typescript'
          //       ],
          //       plugins: ['@babel/plugin-proposal-optional-chaining']
          //     }
          //   })
          // }
        }
      },

      {
        test: /\.css$/,
        use: [
          prod ? MiniCssExtractPlugin.loader : 'style-loader',
          'css-loader',
          'postcss-loader'
        ]
      },

      {
        test: /\.scss$/,
        use: [
          prod ? MiniCssExtractPlugin.loader : 'style-loader',
          'css-loader',
          'postcss-loader',
          'sass-loader',
        ],
      },

      {
        test: /\.(ttf|otf|eot|woff|woff2)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: 'fonts/[hash:base64:8].[ext]',
            esModule: false
          }
        }
      },
      {
        test: /\.(jpg|png)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: 'img/[hash:base64:8].[ext]',
            esModule: false
          }
        }
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'img/[hash:base64:8].[ext]',
              esModule: false
            }
          },
          {
            loader: 'svgo-loader',
            options: {
              plugins: [
                { name: 'removeHiddenElems', active: false }
                // { removeHiddenElems: { displayNone: false } },
                // { cleanupIDs: false },
                // { removeTitle: true }
              ]
            }
          }
        ]
      }
    ]
  },
  mode,
  plugins: [
    ...(prod ? [new CompressionPlugin()] : []),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new Dotenv({path: prod ? '.env-prod' : '.env'}),
    new DefinePlugin({
      'process.env.CLIENT_TYPE': JSON.stringify(process.env.CLIENT_TYPE)
    })
  ],
  devtool: prod ? false : 'source-map',
  devServer: {
    publicPath: '/',
    historyApiFallback: {
      disableDotRule: true
    },
    proxy: devServer ? {
      '/account': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        pathRewrite: { '^/account': '' },
        logLevel: 'debug'
      },
      '/files': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        logLevel: 'debug'
      },
    } : {
      '/account': {
        // target: 'https://ftwm71rwag.execute-api.us-west-2.amazonaws.com/stage/',
        target: 'https://account.hc.engineering/',
        changeOrigin: true,
        pathRewrite: { '^/account': '' },
        logLevel: 'debug'
      },
      '/files': {
        // target: 'https://anticrm-upload.herokuapp.com/',
        // target: 'http://localhost:3000/',  
        target: 'https://front.hc.engineering/files',
        changeOrigin: true,
        pathRewrite: { '^/files': '' },
        logLevel: 'debug'
      },
    }
  }
}
